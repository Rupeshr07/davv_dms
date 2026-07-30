import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth-store'

const navLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'New Record Entry', to: '/records/new' },
  { label: 'Search Records', to: '/records/search' },
  { label: 'Bulk Record Upload', to: '/bulk-upload' },
]

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

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Navigation
          </p>
          <nav className="space-y-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    'block rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
