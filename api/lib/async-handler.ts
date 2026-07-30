import type { NextFunction, Request, RequestHandler, Response } from 'express'

export const asyncHandler =
  (
    callback: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  ): RequestHandler =>
  (req, res, next) => {
    void callback(req, res, next).catch(next)
  }
