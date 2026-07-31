import { LogOut } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth-store'
import davvLogo from "../assets/davv-logo.png"; // Update the path according to your project

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

          {/* Left Section */}
          <div className="flex items-center gap-4">
            <img
              src={davvLogo}
              alt="DAVV Logo"
              className="h-16 w-50 object-contain"
            />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-slate-800">
                {user?.displayName}
              </p>
              <p className="text-xs text-slate-500">{user?.staffId}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-red-600 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all duration-300 hover:bg-red-600 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

        </div>
      </header>

      <div className="mx-auto max-w-0xl px-6 py-4">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
