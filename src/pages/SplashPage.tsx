import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle, WifiOff } from 'lucide-react'
import { appApi, getApiErrorMessage } from '@/lib/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth-store'

export default function SplashPage() {
  useDocumentTitle('Splash Screen')

  const navigate = useNavigate()
  const initialize = useAuthStore((state) => state.initialize)
  const [status, setStatus] = useState('Checking internet connectivity...')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const minimumSplashDelay = 6000

  useEffect(() => {
    let active = true
    const waitForMinimumSplash = async (startedAt: number) => {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, minimumSplashDelay - elapsed)
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining))
      }
    }

    const runStartupChecks = async () => {
      const startedAt = Date.now()

      if (!navigator.onLine) {
        if (active) {
          setLoading(false)
          setStatus('Waiting for internet connection...')
          setError('Internet connection is unavailable. Please reconnect to continue.')
        }
        return
      }

      try {
        if (active) {
          setLoading(true)
          setError('')
          setStatus('Verifying application registration...')
        }

        await appApi.getRegistrationStatus()
        if (active) {
          setStatus('Restoring user session...')
        }

        const user = await initialize()
        if (!active) {
          return
        }

        await waitForMinimumSplash(startedAt)
        if (!active) {
          return
        }

        navigate(user ? '/dashboard' : '/login', { replace: true })
      } catch (startupError) {
        if (active) {
          await waitForMinimumSplash(startedAt)
          setLoading(false)
          setError(getApiErrorMessage(startupError))
          setStatus('Registration verification failed.')
        }
      }
    }

    const handleOnline = () => {
      void runStartupChecks()
    }

    const handleOffline = () => {
      setLoading(false)
      setStatus('Waiting for internet connection...')
      setError('Internet connection is unavailable. Please reconnect to continue.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    void runStartupChecks()

    return () => {
      active = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [initialize, minimumSplashDelay, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_160px_-50px_rgba(37,99,235,0.55)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-300">
          DAVV DMS
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Document Management System</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
          Startup is locked until internet connectivity and application registration verification are both successful.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center gap-3">
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-blue-300" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-300" />
            )}
            <p className="text-sm font-medium text-white">{status}</p>
          </div>
          {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
          {!loading && error ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              Retry startup checks
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
