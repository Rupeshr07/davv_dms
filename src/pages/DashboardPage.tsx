import { ArrowRight, Database, Search, Upload, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageSection from '@/components/PageSection'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const dashboardOptions = [
  {
    title: 'New Record Entry',
    description: 'Create a new document record with controlled metadata and file upload.',
    to: '/records/new',
    icon: Database,
  },
  {
    title: 'Search Records',
    description: 'Find records by branch, subject, date range, remark keywords, or reference number.',
    to: '/records/search',
    icon: Search,
  },
  {
    title: 'Bulk Record Upload',
    description: 'Access the approved Phase-1 bulk upload entry point.',
    to: '/bulk-upload',
    icon: Upload,
  },
  {
    title: 'Logout',
    description: 'End the current session and return to the login screen.',
    to: '/logout',
    icon: LogOut,
  },
]

export default function DashboardPage() {
  useDocumentTitle('Dashboard')

  return (
    <PageSection
      title="Dashboard"
      description="Phase-1 dashboard includes only the approved four actions."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {dashboardOptions.map((option) => {
          const Icon = option.icon
          return (
            <Link
              key={option.title}
              to={option.to}
              className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-slate-300 hover:bg-white hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-slate-900 p-3 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-900" />
              </div>
              <h3 className="mt-6 text-base font-semibold text-slate-900">{option.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{option.description}</p>
            </Link>
          )
        })}
      </div>
    </PageSection>
  )
}
