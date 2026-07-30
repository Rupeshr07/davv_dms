import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page Not Found')

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-300">404</p>
        <h1 className="mt-4 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          The requested page does not exist in the approved Phase-1 workspace.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  )
}
