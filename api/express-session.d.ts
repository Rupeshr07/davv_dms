import 'express-session'
import type { SessionUser } from '../shared/types.js'

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser
  }
}
