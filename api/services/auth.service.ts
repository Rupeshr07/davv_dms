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

  const shouldUseRemoteLogin = env.legacyLoginMode === 'remote' && Boolean(env.legacyLoginUrl)
  if (shouldUseRemoteLogin) {
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
      id: number
      staff_id: string
      name: string
      email: string | null
      password: string
    })[]
  >(
    `SELECT id, staff_id, name, email, password
     FROM tb_account
     WHERE (staff_id = ? OR email = ? OR name = ?)
       AND is_active = 1
       AND status = 1
     LIMIT 1`,
    [parsed.data.username, parsed.data.username, parsed.data.username],
  )

  const matchedUser = rows[0]
  if (!matchedUser) {
    throw new ApiError(401, 'Invalid username or password.')
  }

  const isPasswordValid = await verifyPassword(parsed.data.password, matchedUser.password)
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid username or password.')
  }

  return {
    accountId: matchedUser.id,
    staffId: matchedUser.staff_id,
    username: matchedUser.staff_id,
    displayName: matchedUser.name,
  }
}
