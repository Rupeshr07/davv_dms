import { randomUUID } from 'node:crypto'
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

type OptionRow = DatabaseRow & {
  id: number
  name: string
}

type RecordRow = DatabaseRow & {
  id: string
  reference_number: string
  branch_id: number
  branch_name: string
  subject_id: number
  subject_name: string
  record_date: string | Date
  remark: string | null
  staff_id: string
  record_status: string
  total_pages: number
  document_type: DocumentType
  document_size_bytes: number
  directory_name: string
  created_at: string | Date
  updated_at: string | Date
}

type RecordFileRow = DatabaseRow & {
  id: string
  record_id: string
  original_name: string
  stored_name: string
  mime_type: string
  size_bytes: number
  page_count: number | null
  category_label: string | null
  relative_path: string
  created_at: string | Date
  updated_at: string | Date
}

type RecordSearchRow = DatabaseRow & {
  id: string
  reference_number: string
  branch_name: string
  subject_name: string
  record_date: string | Date
  uploaded_at: string | Date
  modified_at: string | Date
  file_count: number
}

type CountRow = DatabaseRow & {
  total: number
}

type SequenceRow = DatabaseRow & {
  max_sequence: number | null
}

const toIsoString = (value: string | Date): string => new Date(value).toISOString()

const mapFileRow = (row: RecordFileRow): RecordFile => ({
  id: row.id,
  originalName: row.original_name,
  storedName: row.stored_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  relativePath: row.relative_path,
  pageCount: row.page_count,
  categoryLabel: row.category_label,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const mapRecordRow = (row: RecordRow, files: RecordFile[]): RecordEntity => ({
  id: row.id,
  referenceNumber: row.reference_number,
  branchId: row.branch_id,
  branchName: row.branch_name,
  subjectId: row.subject_id,
  subjectName: row.subject_name,
  recordDate: new Date(row.record_date).toISOString().slice(0, 10),
  remark: row.remark ?? '',
  staffId: row.staff_id,
  recordStatus: row.record_status as 'ACTIVE' | 'ARCHIVED',
  totalPages: Number(row.total_pages),
  documentType: row.document_type,
  documentSizeBytes: Number(row.document_size_bytes),
  directoryName: row.directory_name,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  files,
})

const deriveDocumentType = (files: RecordFile[]): DocumentType => {
  const mimeTypes = new Set(
    files.map((file) => {
      if (file.mimeType === 'application/pdf') return 'PDF'
      if (file.mimeType === 'image/png') return 'PNG'
      return 'JPEG'
    }),
  )

  if (mimeTypes.size === 1) {
    return [...mimeTypes][0] as DocumentType
  }

  return 'MIXED'
}

const buildRecordFileSummary = (fileCount: number): string =>
  `${fileCount} file${fileCount === 1 ? '' : 's'}`

const insertRecordFiles = async (
  db: QueryRunner,
  recordId: string,
  files: RecordFile[],
): Promise<void> => {
  if (!files.length) {
    return
  }

  const placeholders = files.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
  const values = files.flatMap((file) => [
    file.id,
    recordId,
    file.originalName,
    file.storedName,
    file.mimeType,
    file.sizeBytes,
    file.pageCount,
    file.categoryLabel,
    file.relativePath,
    new Date(file.createdAt),
  ])

  await db.query(
    `INSERT INTO record_files (
      id,
      record_id,
      original_name,
      stored_name,
      mime_type,
      size_bytes,
      page_count,
      category_label,
      relative_path,
      created_at
    ) VALUES ${placeholders}`,
    values,
  )
}

const getRecordFiles = async (recordId: string, db: QueryRunner): Promise<RecordFile[]> => {
  const [rows] = await db.query<RecordFileRow[]>(
    `SELECT
        id,
        record_id,
        original_name,
        stored_name,
        mime_type,
        size_bytes,
        page_count,
        category_label,
        relative_path,
        created_at,
        updated_at
     FROM record_files
     WHERE record_id = ?
     ORDER BY created_at ASC, original_name ASC`,
    [recordId],
  )

  return rows.map(mapFileRow)
}

const getRecordRowById = async (recordId: string, db: QueryRunner): Promise<RecordRow> => {
  const [rows] = await db.query<RecordRow[]>(
    `SELECT
        r.id,
        r.reference_number,
        r.branch_id,
        b.name AS branch_name,
        r.subject_id,
        s.name AS subject_name,
        r.record_date,
        r.remark,
        r.staff_id,
        r.record_status,
        r.total_pages,
        r.document_type,
        r.document_size_bytes,
        r.directory_name,
        r.created_at,
        r.updated_at
     FROM records r
     INNER JOIN branches b ON b.id = r.branch_id
     INNER JOIN subjects s ON s.id = r.subject_id
     WHERE r.id = ?
     LIMIT 1`,
    [recordId],
  )

  const row = rows[0]
  if (!row) {
    throw new ApiError(404, 'Record not found.')
  }

  return row
}

const getRecordByIdInternal = async (recordId: string, db: QueryRunner): Promise<RecordEntity> => {
  const [row, files] = await Promise.all([getRecordRowById(recordId, db), getRecordFiles(recordId, db)])
  return mapRecordRow(row, files)
}

const getNextSequence = async (db: QueryRunner, year: number): Promise<number> => {
  const [rows] = await db.query<SequenceRow[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(reference_number, '/', -1) AS UNSIGNED)), 0) AS max_sequence
     FROM records
     WHERE reference_number LIKE ?`,
    [`DAVV/${year}/%`],
  )

  return Number(rows[0]?.max_sequence ?? 0) + 1
}

const findBranchAndSubject = async (
  db: QueryRunner,
  branchId: number,
  subjectId: number,
): Promise<{ branch: OptionRow; subject: OptionRow }> => {
  const [[branchRows], [subjectRows]] = await Promise.all([
    db.query<OptionRow[]>(
      `SELECT id, name
       FROM branches
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [branchId],
    ),
    db.query<OptionRow[]>(
      `SELECT id, name
       FROM subjects
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [subjectId],
    ),
  ])

  const branch = branchRows[0]
  const subject = subjectRows[0]

  if (!branch || !subject) {
    throw new ApiError(400, 'Invalid branch or subject selected.')
  }

  return { branch, subject }
}

const normalizeFiles = async (
  uploads: Express.Multer.File[],
  directoryName: string,
): Promise<{ files: RecordFile[]; movedRelativePaths: string[] }> => {
  if (uploads.some((upload) => !acceptedMimeTypes.has(upload.mimetype))) {
    throw new ApiError(400, 'Only PDF, PNG, and JPEG files are allowed.')
  }

  const files: RecordFile[] = []
  const movedRelativePaths: string[] = []
  const now = new Date().toISOString()

  for (const upload of uploads) {
    const fileId = randomUUID()
    const extension = path.extname(upload.originalname) || '.bin'
    const storedName = `${randomUUID()}${extension.toLowerCase()}`
    const relativePath = await moveUploadToRecordFolder(upload.path, directoryName, storedName)
    movedRelativePaths.push(relativePath)

    files.push({
      id: fileId,
      originalName: upload.originalname,
      storedName,
      mimeType: upload.mimetype,
      sizeBytes: upload.size,
      relativePath,
      pageCount: null,
      categoryLabel: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  return { files, movedRelativePaths }
}

const buildWhereClause = (params: RecordSearchParams) => {
  const conditions: string[] = []
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
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
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
  staffId: string,
): Promise<RecordEntity> => {
  const parsed = recordSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid record payload.')
  }

  if (!uploads.length) {
    throw new ApiError(400, 'At least one document file is required.')
  }

  let directoryName = ''
  let movedRelativePaths: string[] = []

  try {
    return await withTransaction(async (connection) => {
      await findBranchAndSubject(connection, parsed.data.branchId, parsed.data.subjectId)

      const year = new Date(parsed.data.recordDate).getFullYear() || new Date().getFullYear()
      const referenceNumber = buildReferenceNumber(await getNextSequence(connection, year), year)
      directoryName = buildRecordDirectoryName(referenceNumber)

      const normalizedUploads = await normalizeFiles(uploads, directoryName)
      movedRelativePaths = normalizedUploads.movedRelativePaths

      const recordId = randomUUID()
      const files = normalizedUploads.files
      const now = new Date()

      await connection.query(
        `INSERT INTO records (
          id,
          reference_number,
          branch_id,
          subject_id,
          record_date,
          remark,
          staff_id,
          record_status,
          total_pages,
          document_type,
          document_size_bytes,
          directory_name,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          referenceNumber,
          parsed.data.branchId,
          parsed.data.subjectId,
          parsed.data.recordDate,
          parsed.data.remark ?? '',
          staffId,
          files.length,
          deriveDocumentType(files),
          files.reduce((sum, file) => sum + file.sizeBytes, 0),
          directoryName,
          now,
          now,
        ],
      )

      await insertRecordFiles(connection, recordId, files)
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
     FROM records r
     ${clause}`,
    values,
  )

  const totalItems = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const offset = (page - 1) * pageSize

  const [rows] = await pool.query<RecordSearchRow[]>(
    `SELECT
        r.id,
        r.reference_number,
        b.name AS branch_name,
        s.name AS subject_name,
        r.record_date,
        r.created_at AS uploaded_at,
        r.updated_at AS modified_at,
        COUNT(rf.id) AS file_count
     FROM records r
     INNER JOIN branches b ON b.id = r.branch_id
     INNER JOIN subjects s ON s.id = r.subject_id
     LEFT JOIN record_files rf ON rf.record_id = r.id
     ${clause}
     GROUP BY
       r.id,
       r.reference_number,
       b.name,
       s.name,
       r.record_date,
       r.created_at,
       r.updated_at
     ORDER BY r.record_date DESC, r.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  )

  return {
    items: rows.map((row) => ({
      id: row.id,
      referenceNumber: row.reference_number,
      branchName: row.branch_name,
      subjectName: row.subject_name,
      recordDate: new Date(row.record_date).toISOString().slice(0, 10),
      recordFileSummary: buildRecordFileSummary(Number(row.file_count)),
      uploadedAt: toIsoString(row.uploaded_at),
      modifiedAt: toIsoString(row.modified_at),
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

export const getRecordById = async (recordId: string): Promise<RecordEntity> =>
  getRecordByIdInternal(recordId, pool)

export const updateRecord = async (
  recordId: string,
  payload: UpdateRecordInput,
  uploads: Express.Multer.File[],
): Promise<RecordEntity> => {
  const parsed = recordSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid record payload.')
  }

  const removedFileIds = payload.removeFileIds ?? []
  const removeSet = new Set(removedFileIds)
  let movedRelativePaths: string[] = []
  let removedFiles: RecordFile[] = []

  try {
    const record = await withTransaction(async (connection) => {
      const existingRecord = await getRecordByIdInternal(recordId, connection)
      await findBranchAndSubject(connection, parsed.data.branchId, parsed.data.subjectId)

      removedFiles = existingRecord.files.filter((file) => removeSet.has(file.id))
      const keptFiles = existingRecord.files.filter((file) => !removeSet.has(file.id))
      const normalizedUploads = await normalizeFiles(uploads, existingRecord.directoryName)
      movedRelativePaths = normalizedUploads.movedRelativePaths

      const nextFiles = [...keptFiles, ...normalizedUploads.files]
      if (!nextFiles.length) {
        throw new ApiError(400, 'At least one document file is required.')
      }

      if (removedFileIds.length) {
        const deletePlaceholders = removedFileIds.map(() => '?').join(', ')
        await connection.query(
          `DELETE FROM record_files
           WHERE record_id = ? AND id IN (${deletePlaceholders})`,
          [recordId, ...removedFileIds],
        )
      }

      await insertRecordFiles(connection, recordId, normalizedUploads.files)

      await connection.query(
        `UPDATE records
         SET
           branch_id = ?,
           subject_id = ?,
           record_date = ?,
           remark = ?,
           total_pages = ?,
           document_type = ?,
           document_size_bytes = ?,
           updated_at = ?
         WHERE id = ?`,
        [
          parsed.data.branchId,
          parsed.data.subjectId,
          parsed.data.recordDate,
          parsed.data.remark ?? '',
          nextFiles.length,
          deriveDocumentType(nextFiles),
          nextFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
          new Date(),
          recordId,
        ],
      )

      return getRecordByIdInternal(recordId, connection)
    })

    await Promise.all(removedFiles.map((file) => deleteStoredFile(file.relativePath)))
    return record
  } catch (error) {
    await Promise.all(movedRelativePaths.map((relativePath) => deleteStoredFile(relativePath)))
    throw error
  }
}

export const deleteRecord = async (recordId: string): Promise<void> => {
  const directoryName = await withTransaction(async (connection) => {
    const record = await getRecordByIdInternal(recordId, connection)
    await connection.query('DELETE FROM records WHERE id = ?', [recordId])
    return record.directoryName
  })

  await deleteRecordFolder(directoryName)
}

export const getRecordViewer = async (recordId: string): Promise<RecordViewerResponse> => {
  const record = await getRecordById(recordId)
  const categoryMap = new Map<string, RecordFile[]>()

  for (const file of record.files) {
    const label = file.categoryLabel ?? 'Uploaded Files'
    const existing = categoryMap.get(label) ?? []
    existing.push(file)
    categoryMap.set(label, existing)
  }

  return {
    record,
    categories: [...categoryMap.entries()].map(([label, files], index) => ({
      id: `category-${index + 1}`,
      label,
      files,
    })),
  }
}
