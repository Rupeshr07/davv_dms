import path from 'node:path'
import type { PoolConnection } from 'mysql2/promise'
import { z } from 'zod'
import type { DatabaseRow } from '../db/mysql.js'
import { pool, withTransaction } from '../db/mysql.js'
import { ApiError } from '../lib/errors.js'
import {
  buildRecordDirectoryName,
  deleteStoredFile,
  deleteRecordFolder,
  moveUploadToRecordFolder,
} from '../utils/file-storage.js'
import { buildReferenceNumber } from '../utils/reference-number.js'
import type {
  DocumentType,
  RecordEntity,
  RecordFile,
  RecordSearchParams,
  RecordSearchResponse,
  RecordViewerResponse,
} from '../../shared/types.js'

const recordSchema = z.object({
  branchId: z.coerce.number().int().positive('Branch is required.'),
  subjectId: z.coerce.number().int().positive('Subject is required.'),
  recordDate: z.string().min(1, 'Date is required.'),
  remark: z.string().trim().max(500, 'Remark can contain up to 500 characters.').optional(),
})

const acceptedMimeTypes = new Set(['application/pdf', 'image/png', 'image/jpeg'])

type QueryRunner = PoolConnection | typeof pool

type RecordInput = {
  branchId: string | number
  subjectId: string | number
  recordDate: string
  remark?: string
}

type UpdateRecordInput = RecordInput & {
  removeFileIds?: string[]
}

type BranchRow = DatabaseRow & {
  id: number
  name: string
}

type SubjectRow = DatabaseRow & {
  id: number
  name: string
}

type RecordRow = DatabaseRow & {
  id: number
  reference_number: string
  branch_id: number
  branch_name: string
  subject_id: number
  subject_name: string
  record_date: string | Date
  remark: string | null
  staff_id: string
  record_status: string
  total_pages: number | null
  document_type: string
  file_size: number | null
  directory_name: string
  uploaded_at: string | Date | null
  modified_at: string | Date | null
  created_at: string | Date
  updated_at: string | Date
}

type FileRow = DatabaseRow & {
  id: number
  record_id: number
  file_name: string
  original_name: string | null
  file_path: string
  mime_type: string | null
  extension: string | null
  page_number: number | null
  file_size: number | null
  created_at: string | Date
  updated_at: string | Date
}

type CountRow = DatabaseRow & {
  total: number
}

type SequenceRow = DatabaseRow & {
  max_sequence: number | null
}

type InsertIdRow = DatabaseRow & {
  id: number
}

const toIsoString = (value: string | Date | null | undefined): string => {
  if (!value) {
    return new Date().toISOString()
  }

  return new Date(value).toISOString()
}

const deriveDocumentTypeFromMime = (mimeType: string): DocumentType => {
  if (mimeType === 'application/pdf') {
    return 'PDF'
  }

  if (mimeType === 'image/png') {
    return 'PNG'
  }

  return 'JPEG'
}

const deriveDocumentType = (files: Array<Pick<RecordFile, 'mimeType'>>): DocumentType => {
  if (!files.length) {
    return 'PDF'
  }

  return deriveDocumentTypeFromMime(files[0].mimeType)
}

const buildRecordFileSummary = (fileCount: number): string =>
  `${fileCount} file${fileCount === 1 ? '' : 's'}`

const mapFileRow = (row: FileRow): RecordFile => ({
  id: String(row.id),
  originalName: row.original_name || row.file_name,
  storedName: row.file_name,
  mimeType: row.mime_type || 'application/octet-stream',
  sizeBytes: Number(row.file_size ?? 0),
  relativePath: row.file_path,
  pageCount: row.page_number,
  categoryLabel: null,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const mapRecordRow = (row: RecordRow, files: RecordFile[]): RecordEntity => ({
  id: String(row.id),
  referenceNumber: row.reference_number,
  branchId: row.branch_id,
  branchName: row.branch_name,
  subjectId: row.subject_id,
  subjectName: row.subject_name,
  recordDate: new Date(row.record_date).toISOString().slice(0, 10),
  remark: row.remark ?? '',
  staffId: row.staff_id,
  recordStatus: (row.record_status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'),
  totalPages: Number(row.total_pages ?? files.length),
  documentType:
    row.document_type === 'PNG'
      ? 'PNG'
      : row.document_type === 'JPEG' || row.document_type === 'JPG'
        ? 'JPEG'
        : 'PDF',
  documentSizeBytes: Number(row.file_size ?? 0),
  directoryName: row.directory_name,
  createdAt: toIsoString(row.uploaded_at ?? row.created_at),
  updatedAt: toIsoString(row.modified_at ?? row.updated_at),
  files,
})

const getRecordFiles = async (recordId: number, db: QueryRunner): Promise<RecordFile[]> => {
  const [rows] = await db.query<FileRow[]>(
    `SELECT
        id,
        record_id,
        file_name,
        original_name,
        file_path,
        mime_type,
        extension,
        page_number,
        file_size,
        created_at,
        updated_at
     FROM files
     WHERE record_id = ?
     ORDER BY id ASC`,
    [recordId],
  )

  return rows.map(mapFileRow)
}

const getRecordRowById = async (recordId: number, db: QueryRunner): Promise<RecordRow> => {
  const [rows] = await db.query<RecordRow[]>(
    `SELECT
        r.id,
        r.reference_number,
        r.branch_id,
        b.branch_name AS branch_name,
        r.subject_id,
        s.subject_name AS subject_name,
        r.record_date,
        r.remark,
        a.staff_id,
        r.record_status,
        r.total_pages,
        r.document_type,
        r.file_size,
        r.directory_name,
        r.uploaded_at,
        r.modified_at,
        r.created_at,
        r.updated_at
     FROM tb_records r
     INNER JOIN tb_branches b ON b.id = r.branch_id
     INNER JOIN tb_subject s ON s.id = r.subject_id
     INNER JOIN tb_account a ON a.id = r.uploaded_by
     WHERE r.id = ?
       AND r.record_status <> 'DELETED'
     LIMIT 1`,
    [recordId],
  )

  const row = rows[0]
  if (!row) {
    throw new ApiError(404, 'Record not found.')
  }

  return row
}

const getRecordByIdInternal = async (recordId: number, db: QueryRunner): Promise<RecordEntity> => {
  const [row, files] = await Promise.all([getRecordRowById(recordId, db), getRecordFiles(recordId, db)])
  return mapRecordRow(row, files)
}

const getNextSequence = async (db: QueryRunner, year: number): Promise<number> => {
  const [rows] = await db.query<SequenceRow[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(reference_number, '/', -1) AS UNSIGNED)), 0) AS max_sequence
     FROM tb_records
     WHERE reference_number LIKE ?`,
    [`DAVV/${year}/%`],
  )

  return Number(rows[0]?.max_sequence ?? 0) + 1
}

const ensureValidBranchAndSubject = async (
  db: QueryRunner,
  branchId: number,
  subjectId: number,
): Promise<void> => {
  const [[branchRows], [subjectRows]] = await Promise.all([
    db.query<BranchRow[]>(
      `SELECT id, branch_name AS name
       FROM tb_branches
       WHERE id = ?
         AND is_active = 1
         AND status = 'Active'
       LIMIT 1`,
      [branchId],
    ),
    db.query<SubjectRow[]>(
      `SELECT id, subject_name AS name
       FROM tb_subject
       WHERE id = ?
         AND is_active = 1
         AND status = 1
       LIMIT 1`,
      [subjectId],
    ),
  ])

  if (!branchRows[0] || !subjectRows[0]) {
    throw new ApiError(400, 'Invalid branch or subject selected.')
  }
}

const normalizeFiles = async (
  uploads: Express.Multer.File[],
  directoryName: string,
): Promise<{ files: Omit<RecordFile, 'id'>[]; movedRelativePaths: string[] }> => {
  if (uploads.some((upload) => !acceptedMimeTypes.has(upload.mimetype))) {
    throw new ApiError(400, 'Only PDF, PNG, and JPEG files are allowed.')
  }

  const files: Omit<RecordFile, 'id'>[] = []
  const movedRelativePaths: string[] = []
  const now = new Date().toISOString()

  for (const upload of uploads) {
    const extension = (path.extname(upload.originalname) || '.bin').toLowerCase()
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`
    const relativePath = await moveUploadToRecordFolder(upload.path, directoryName, storedName)
    movedRelativePaths.push(relativePath)

    files.push({
      originalName: upload.originalname,
      storedName,
      mimeType: upload.mimetype,
      sizeBytes: upload.size,
      relativePath,
      pageCount: 1,
      categoryLabel: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  return { files, movedRelativePaths }
}

const insertFiles = async (
  db: QueryRunner,
  recordId: number,
  files: Omit<RecordFile, 'id'>[],
  accountId: number | null,
): Promise<void> => {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const extension = path.extname(file.storedName).replace('.', '').toLowerCase()

    await db.query(
      `INSERT INTO files (
        record_id,
        file_name,
        original_name,
        file_path,
        mime_type,
        extension,
        page_number,
        file_size,
        is_primary,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        file.storedName,
        file.originalName,
        file.relativePath,
        file.mimeType,
        extension,
        file.pageCount ?? 1,
        file.sizeBytes,
        index === 0 ? 1 : 0,
        accountId,
        accountId,
      ],
    )
  }
}

const buildWhereClause = (params: RecordSearchParams) => {
  const conditions = [`r.record_status <> 'DELETED'`]
  const values: Array<number | string> = []

  if (params.branchId) {
    conditions.push('r.branch_id = ?')
    values.push(params.branchId)
  }

  if (params.subjectId) {
    conditions.push('r.subject_id = ?')
    values.push(params.subjectId)
  }

  if (params.referenceNumber?.trim()) {
    conditions.push('r.reference_number LIKE ?')
    values.push(`%${params.referenceNumber.trim()}%`)
  }

  if (params.remarkKeywords?.trim()) {
    conditions.push('r.remark LIKE ?')
    values.push(`%${params.remarkKeywords.trim()}%`)
  }

  if (params.dateFrom) {
    conditions.push('r.record_date >= ?')
    values.push(params.dateFrom)
  }

  if (params.dateTo) {
    conditions.push('r.record_date <= ?')
    values.push(params.dateTo)
  }

  return {
    clause: `WHERE ${conditions.join(' AND ')}`,
    values,
  }
}

export const getNextReferenceNumber = async (): Promise<string> => {
  const year = new Date().getFullYear()
  const sequence = await getNextSequence(pool, year)
  return buildReferenceNumber(sequence, year)
}

export const createRecord = async (
  payload: RecordInput,
  uploads: Express.Multer.File[],
  accountId: number,
): Promise<RecordEntity> => {
  const parsed = recordSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid record payload.')
  }

  if (!accountId) {
    throw new ApiError(401, 'Authentication required.')
  }

  let directoryName = ''
  let movedRelativePaths: string[] = []

  try {
    return await withTransaction(async (connection) => {
      await ensureValidBranchAndSubject(connection, parsed.data.branchId, parsed.data.subjectId)

      const year = new Date(parsed.data.recordDate).getFullYear() || new Date().getFullYear()
      const referenceNumber = buildReferenceNumber(await getNextSequence(connection, year), year)
      directoryName = buildRecordDirectoryName(referenceNumber)

      const normalizedUploads = uploads.length
        ? await normalizeFiles(uploads, directoryName)
        : { files: [], movedRelativePaths: [] }
      movedRelativePaths = normalizedUploads.movedRelativePaths
      const documentType = deriveDocumentType(normalizedUploads.files)
      const totalFileSize = normalizedUploads.files.reduce((sum, file) => sum + file.sizeBytes, 0)

      await connection.query(
        `INSERT INTO tb_records (
          reference_number,
          branch_id,
          subject_id,
          record_date,
          remark,
          document_type,
          total_pages,
          file_size,
          directory_name,
          record_status,
          status,
          uploaded_by,
          uploaded_at,
          modified_by,
          modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, NOW(), ?, NOW())`,
        [
          referenceNumber,
          parsed.data.branchId,
          parsed.data.subjectId,
          parsed.data.recordDate,
          parsed.data.remark ?? '',
          documentType,
          normalizedUploads.files.length,
          totalFileSize,
          directoryName,
          accountId,
          accountId,
        ],
      )

      const [idRows] = await connection.query<InsertIdRow[]>('SELECT LAST_INSERT_ID() AS id')
      const recordId = Number(idRows[0]?.id)

      if (normalizedUploads.files.length) {
        await insertFiles(connection, recordId, normalizedUploads.files, accountId)
      }

      return getRecordByIdInternal(recordId, connection)
    })
  } catch (error) {
    await Promise.all(movedRelativePaths.map((relativePath) => deleteStoredFile(relativePath)))
    if (directoryName) {
      await deleteRecordFolder(directoryName)
    }
    throw error
  }
}

export const searchRecords = async (params: RecordSearchParams): Promise<RecordSearchResponse> => {
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 10)))
  const { clause, values } = buildWhereClause(params)

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM tb_records r
     ${clause}`,
    values,
  )

  const totalItems = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const offset = (page - 1) * pageSize

  const [rows] = await pool.query<(RecordRow & { file_count: number })[]>(
    `SELECT
        r.id,
        r.reference_number,
        r.branch_id,
        b.branch_name AS branch_name,
        r.subject_id,
        s.subject_name AS subject_name,
        r.record_date,
        r.remark,
        a.staff_id,
        r.record_status,
        r.total_pages,
        r.document_type,
        r.file_size,
        r.directory_name,
        r.uploaded_at,
        r.modified_at,
        r.created_at,
        r.updated_at,
        COUNT(f.id) AS file_count
     FROM tb_records r
     INNER JOIN tb_branches b ON b.id = r.branch_id
     INNER JOIN tb_subject s ON s.id = r.subject_id
     INNER JOIN tb_account a ON a.id = r.uploaded_by
     LEFT JOIN files f ON f.record_id = r.id
     ${clause}
     GROUP BY
        r.id,
        r.reference_number,
        r.branch_id,
        b.branch_name,
        r.subject_id,
        s.subject_name,
        r.record_date,
        r.remark,
        a.staff_id,
        r.record_status,
        r.total_pages,
        r.document_type,
        r.file_size,
        r.directory_name,
        r.uploaded_at,
        r.modified_at,
        r.created_at,
        r.updated_at
     ORDER BY r.record_date DESC, COALESCE(r.modified_at, r.updated_at) DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  )

  return {
    items: rows.map((row) => ({
      id: String(row.id),
      referenceNumber: row.reference_number,
      branchName: row.branch_name,
      subjectName: row.subject_name,
      recordDate: new Date(row.record_date).toISOString().slice(0, 10),
      recordFileSummary: buildRecordFileSummary(Number(row.file_count)),
      uploadedAt: toIsoString(row.uploaded_at ?? row.created_at),
      modifiedAt: toIsoString(row.modified_at ?? row.updated_at),
    })),
    page,
    pageSize,
    totalItems,
    totalPages,
    sort: {
      field: 'recordDate',
      direction: 'desc',
    },
  }
}

export const getRecordById = async (recordId: string): Promise<RecordEntity> => {
  const numericRecordId = Number(recordId)
  if (!numericRecordId) {
    throw new ApiError(404, 'Record not found.')
  }

  return getRecordByIdInternal(numericRecordId, pool)
}

export const updateRecord = async (
  recordId: string,
  payload: UpdateRecordInput,
  uploads: Express.Multer.File[],
): Promise<RecordEntity> => {
  const parsed = recordSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid record payload.')
  }

  const numericRecordId = Number(recordId)
  if (!numericRecordId) {
    throw new ApiError(404, 'Record not found.')
  }

  const removedFileIds = (payload.removeFileIds ?? [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)

  let movedRelativePaths: string[] = []
  let removedFiles: RecordFile[] = []

  try {
    const updatedRecord = await withTransaction(async (connection) => {
      const existingRecord = await getRecordByIdInternal(numericRecordId, connection)
      await ensureValidBranchAndSubject(connection, parsed.data.branchId, parsed.data.subjectId)

      removedFiles = existingRecord.files.filter((file) => removedFileIds.includes(Number(file.id)))
      const keptFiles = existingRecord.files.filter((file) => !removedFileIds.includes(Number(file.id)))
      const normalizedUploads = await normalizeFiles(uploads, existingRecord.directoryName)
      movedRelativePaths = normalizedUploads.movedRelativePaths

      const nextFiles = [
        ...keptFiles,
        ...normalizedUploads.files.map((file) => ({ ...file, id: '0' })),
      ]

      if (!nextFiles.length) {
        throw new ApiError(400, 'At least one document file is required.')
      }

      if (removedFileIds.length) {
        const placeholders = removedFileIds.map(() => '?').join(', ')
        await connection.query(
          `DELETE FROM files
           WHERE record_id = ?
             AND id IN (${placeholders})`,
          [numericRecordId, ...removedFileIds],
        )
      }

      await insertFiles(connection, numericRecordId, normalizedUploads.files, null)

      await connection.query(
        `UPDATE tb_records
         SET
           branch_id = ?,
           subject_id = ?,
           record_date = ?,
           remark = ?,
           document_type = ?,
           total_pages = ?,
           file_size = ?,
           modified_at = NOW()
         WHERE id = ?`,
        [
          parsed.data.branchId,
          parsed.data.subjectId,
          parsed.data.recordDate,
          parsed.data.remark ?? '',
          deriveDocumentType(nextFiles),
          nextFiles.length,
          nextFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
          numericRecordId,
        ],
      )

      return getRecordByIdInternal(numericRecordId, connection)
    })

    await Promise.all(removedFiles.map((file) => deleteStoredFile(file.relativePath)))
    return updatedRecord
  } catch (error) {
    await Promise.all(movedRelativePaths.map((relativePath) => deleteStoredFile(relativePath)))
    throw error
  }
}

export const deleteRecord = async (recordId: string): Promise<void> => {
  const numericRecordId = Number(recordId)
  if (!numericRecordId) {
    throw new ApiError(404, 'Record not found.')
  }

  const directoryName = await withTransaction(async (connection) => {
    const record = await getRecordByIdInternal(numericRecordId, connection)
    await connection.query('DELETE FROM tb_records WHERE id = ?', [numericRecordId])
    return record.directoryName
  })

  await deleteRecordFolder(directoryName)
}

export const getRecordViewer = async (recordId: string): Promise<RecordViewerResponse> => {
  const record = await getRecordById(recordId)
  return {
    record,
    categories: [
      {
        id: 'category-1',
        label: 'Uploaded Files',
        files: record.files,
      },
    ],
  }
}
