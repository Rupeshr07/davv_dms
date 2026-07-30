import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth-store'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function LogoutPage() {
  useDocumentTitle('Logout')

  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    const runLogout = async () => {
      await logout()
      navigate('/login', { replace: true })
    }

    void runLogout()
  }, [logout, navigate])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
        Ending your session...
      </div>
    </div>
  )
}
