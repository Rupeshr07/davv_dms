import { FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth-store'

export default function LoginPage() {
  useDocumentTitle('Login')

  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const { user, loading, error, login, clearError } = useAuthStore()
  const [formState, setFormState] = useState({
    username: '',
    password: '',
  })

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
  }, [from, navigate, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearError()
    await login(formState)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.2fr_0.8fr]">
      <div className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-blue-300">
            DAVV DMS
          </p>
          <h1 className="mt-6 max-w-lg text-4xl font-semibold leading-tight">
            Professional record handling for DAVV staff operations.
          </h1>
        </div>
        <div className="grid gap-4">
          {[
            'Secure session-based access for Phase-1 workflows',
            'Metadata-driven search with server-side pagination',
            'Controlled file upload, viewer, ZIP download, and delete operations',
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] px-6 py-12">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
          <div className="inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Staff Login</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sign in with your approved DAVV staff credentials to continue to Phase-1 operations.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Username</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  required
                  value={formState.username}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, username: event.target.value }))
                  }
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Enter username"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <input
                  required
                  type="password"
                  value={formState.password}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Enter password"
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
