import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { verifyRegistration } from '../services/app.service.js'

const router = Router()

router.get(
  '/registration-status',
  asyncHandler(async (_req, res) => {
    const status = await verifyRegistration()
    res.status(200).json({
      success: true,
      message: status.message,
      data: status,
    })
  }),
)

export default router
