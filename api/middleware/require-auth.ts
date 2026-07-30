import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../lib/errors.js'

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.session.user) {
    next(new ApiError(401, 'Authentication required.'))
    return
  }

  next()
}
