import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import path from 'node:path'
import appRoutes from './routes/app.js'
import authRoutes from './routes/auth.js'
import masterDataRoutes from './routes/master-data.js'
import recordsRoutes from './routes/records.js'
import { env } from './config/env.js'
import { ApiError } from './lib/errors.js'
import { ensureUploadRoots, uploadsRoot } from './utils/file-storage.js'

void ensureUploadRoots()

const app: express.Application = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(
  session({
    name: 'davv_dms_session',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
)

app.use('/uploads', express.static(path.resolve(uploadsRoot)))

app.use('/api/app', appRoutes)
app.use('/api/auth', authRoutes)
app.use('/api', masterDataRoutes)
app.use('/api/records', recordsRoutes)

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ok',
    data: {
      uptime: process.uptime(),
    },
  })
})

app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  void next
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: null,
    })
    return
  }

  res.status(500).json({
    success: false,
    message: error.message || 'Server internal error',
    data: null,
  })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API not found',
    data: null,
  })
})

export default app
