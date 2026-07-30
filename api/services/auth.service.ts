import axios from 'axios'
import { z } from 'zod'
import { env } from '../config/env.js'
import type { DatabaseRow } from '../db/mysql.js'
import { pool } from '../db/mysql.js'
import { ApiError } from '../lib/errors.js'
import { verifyPassword } from '../lib/password.js'
import type { LoginRequest, SessionUser } from '../../shared/types.js'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
})

const extractRemoteUser = (payload: unknown, fallbackUsername: string): SessionUser => {
  const data = payload as Record<string, unknown>
  return {
    staffId:
      typeof data.staffId === 'string'
        ? data.staffId
        : typeof data.userId === 'string'
          ? data.userId
          : fallbackUsername.toUpperCase(),
    username:
      typeof data.username === 'string'
        ? data.username
        : typeof data.loginId === 'string'
          ? data.loginId
          : fallbackUsername,
    displayName:
      typeof data.displayName === 'string'
        ? data.displayName
        : typeof data.name === 'string'
          ? data.name
          : 'DAVV Staff User',
  }
}

export const authenticateUser = async (payload: LoginRequest): Promise<SessionUser> => {
  const parsed = loginSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid login payload.')
  }

  if (env.legacyLoginMode === 'remote') {
    if (!env.legacyLoginUrl) {
      throw new ApiError(500, 'Legacy login API URL is not configured.')
    }

    try {
      const response = await axios.post(env.legacyLoginUrl, parsed.data, {
        timeout: 10000,
      })
      return extractRemoteUser(response.data, parsed.data.username)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          typeof error.response?.data?.message === 'string'
            ? error.response.data.message
            : typeof error.response?.data?.error === 'string'
              ? error.response.data.error
              : 'Login failed.'
        throw new ApiError(error.response?.status ?? 401, message)
      }

      throw new ApiError(401, 'Login failed.')
    }
  }

  const [rows] = await pool.query<
    (DatabaseRow & {
      staff_id: string
      username: string
      display_name: string
      password_hash: string
    })[]
  >(
    `SELECT staff_id, username, display_name, password_hash
     FROM staff_users
     WHERE username = ? AND is_active = 1
     LIMIT 1`,
    [parsed.data.username],
  )

  const matchedUser = rows[0]
  if (!matchedUser) {
    throw new ApiError(401, 'Invalid username or password.')
  }

  const isPasswordValid = await verifyPassword(parsed.data.password, matchedUser.password_hash)
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid username or password.')
  }

  return {
    staffId: matchedUser.staff_id,
    username: matchedUser.username,
    displayName: matchedUser.display_name,
  }
}
