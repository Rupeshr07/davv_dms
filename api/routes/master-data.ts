import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { requireAuth } from '../middleware/require-auth.js'
import { getBranches, getSubjects } from '../services/master-data.service.js'

const router = Router()

router.get(
  '/branches',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Branches fetched.',
      data: await getBranches(),
    })
  }),
)

router.get(
  '/subjects',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Subjects fetched.',
      data: await getSubjects(),
    })
  }),
)

export default router
