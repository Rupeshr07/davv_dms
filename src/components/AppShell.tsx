import { LogOut } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth-store'

export default function AppShell() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)]">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-700">
              DAVV Document Management System
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">Phase-1 Operations Console</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-slate-800">{user?.displayName}</p>
              <p className="text-xs text-slate-500">{user?.staffId}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
