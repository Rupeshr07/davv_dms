import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { authenticateUser } from '../services/auth.service.js'

const router = Router()

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const user = await authenticateUser(req.body)
    req.session.user = user

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: user,
    })
  }),
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    res.clearCookie('davv_dms_session')
    res.status(200).json({
      success: true,
      message: 'Logout successful.',
      data: null,
    })
  }),
)

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Session fetched.',
      data: req.session.user ?? null,
    })
  }),
)

export default router
