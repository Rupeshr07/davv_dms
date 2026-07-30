import { create } from 'zustand'
import { appApi, getApiErrorMessage } from '@/lib/api'
import type { LoginRequest, SessionUser } from '../../shared/types'

type AuthState = {
  user: SessionUser | null
  initialized: boolean
  loading: boolean
  error: string
  initialize: () => Promise<SessionUser | null>
  login: (payload: LoginRequest) => Promise<SessionUser>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  loading: false,
  error: '',
  initialize: async () => {
    set({ loading: true, error: '' })

    try {
      const user = await appApi.getSession()
      set({ user, initialized: true, loading: false })
      return user
    } catch {
      set({ user: null, initialized: true, loading: false })
      return null
    }
  },
  login: async (payload) => {
    set({ loading: true, error: '' })

    try {
      const user = await appApi.login(payload)
      set({ user, loading: false, initialized: true })
      return user
    } catch (error) {
      const message = getApiErrorMessage(error)
      set({ loading: false, error: message })
      throw error
    }
  },
  logout: async () => {
    set({ loading: true, error: '' })
    try {
      await appApi.logout()
    } finally {
      set({ user: null, loading: false, initialized: true })
    }
  },
  clearError: () => set({ error: '' }),
}))
