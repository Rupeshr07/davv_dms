import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { requireAuth } from '../middleware/require-auth.js'
import { upload } from '../middleware/upload.js'
import {
  createRecord,
  deleteRecord,
  getNextReferenceNumber,
  getRecordById,
  getRecordViewer,
  searchRecords,
  updateRecord,
} from '../services/records.service.js'
import { streamRecordFolderZip } from '../utils/file-storage.js'

const router = Router()

const parseRemoveFileIds = (value: unknown): string[] => {
  if (typeof value !== 'string' || !value.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

router.get(
  '/reference-number',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Reference number generated.',
      data: { referenceNumber: await getNextReferenceNumber() },
    })
  }),
)

router.post(
  '/',
  requireAuth,
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    const record = await createRecord(
      req.body,
      (req.files as Express.Multer.File[]) ?? [],
      req.session.user!.staffId,
    )

    res.status(201).json({
      success: true,
      message: 'Record created successfully.',
      data: record,
    })
  }),
)

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await searchRecords({
      branchId: req.query.branchId ? Number(req.query.branchId) : undefined,
      subjectId: req.query.subjectId ? Number(req.query.subjectId) : undefined,
      referenceNumber:
        typeof req.query.referenceNumber === 'string' ? req.query.referenceNumber : undefined,
      remarkKeywords:
        typeof req.query.remarkKeywords === 'string' ? req.query.remarkKeywords : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 10),
    })

    res.status(200).json({
      success: true,
      message: 'Records fetched.',
      data: result,
    })
  }),
)

router.get(
  '/:recordId',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Record fetched.',
      data: await getRecordById(req.params.recordId),
    })
  }),
)

router.put(
  '/:recordId',
  requireAuth,
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    const record = await updateRecord(
      req.params.recordId,
      {
        ...req.body,
        removeFileIds: parseRemoveFileIds(req.body.removeFileIds),
      },
      (req.files as Express.Multer.File[]) ?? [],
    )

    res.status(200).json({
      success: true,
      message: 'Record updated successfully.',
      data: record,
    })
  }),
)

router.delete(
  '/:recordId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteRecord(req.params.recordId)
    res.status(200).json({
      success: true,
      message: 'Record deleted successfully.',
      data: null,
    })
  }),
)

router.get(
  '/:recordId/viewer',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Viewer data fetched.',
      data: await getRecordViewer(req.params.recordId),
    })
  }),
)

router.get(
  '/:recordId/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const record = await getRecordById(req.params.recordId)
    await streamRecordFolderZip(record.directoryName, record.referenceNumber, res)
  }),
)

export default router
