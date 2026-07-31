import { FormEvent, useEffect, useState } from 'react'
import {
  ArrowRight,
  Database,
  LockKeyhole,
  LogOut,
  Save,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import SearchableSelect from '@/components/SearchableSelect'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appApi, getApiErrorMessage } from '@/lib/api'
import type { BranchOption, SubjectOption } from '../../shared/types'

type QuickFormState = {
  branchId?: number
  subjectId?: number
  recordDate: string
  remark: string
}

const quickFormInitialState: QuickFormState = {
  branchId: undefined,
  subjectId: undefined,
  recordDate: new Date().toISOString().slice(0, 10),
  remark: '',
}

const cardStyles = {
  blue: {
    border: 'border-blue-100',
    shell: 'from-white to-blue-50/80',
    iconWrap: 'bg-blue-100 text-blue-600',
    arrowWrap: 'border-blue-100 text-blue-600 shadow-blue-100/80',
    wave: 'from-blue-100/0 via-blue-100/70 to-blue-200/90',
  },
  green: {
    border: 'border-emerald-100',
    shell: 'from-white to-emerald-50/80',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    arrowWrap: 'border-emerald-100 text-emerald-600 shadow-emerald-100/80',
    wave: 'from-emerald-100/0 via-emerald-100/70 to-emerald-200/90',
  },
  violet: {
    border: 'border-violet-100',
    shell: 'from-white to-violet-50/80',
    iconWrap: 'bg-violet-100 text-violet-600',
    arrowWrap: 'border-violet-100 text-violet-600 shadow-violet-100/80',
    wave: 'from-violet-100/0 via-violet-100/70 to-violet-200/90',
  },
  red: {
    border: 'border-red-100',
    shell: 'from-white to-red-50/80',
    iconWrap: 'bg-red-100 text-red-500',
    arrowWrap: 'border-red-100 text-red-500 shadow-red-100/80',
    wave: 'from-red-100/0 via-red-100/70 to-red-200/90',
  },
} as const

const dashboardCards = [
  {
    title: 'New Record Entry',
    description: 'Start a new record in a popup, save the metadata, then continue on the record entry screen.',
    icon: Database,
    color: 'blue',
    type: 'button',
  },
  {
    title: 'Search Records',
    description: 'Find records by branch, subject, date range, remark keywords, or reference number.',
    to: '/records/search',
    icon: Search,
    color: 'green',
    type: 'link',
  },
  {
    title: 'Bulk Record Upload',
    description: 'Access the approved Phase-1 bulk upload entry point.',
    to: '/bulk-upload',
    icon: Upload,
    color: 'violet',
    type: 'link',
  },
  {
    title: 'Support',
    description: 'Contact support for any questions or issues.',
    to: '/support',
    icon: ShieldCheck,
    color: 'red',
    type: 'link',
  },
] as const

export default function DashboardPage() {
  useDocumentTitle('Dashboard')

  const navigate = useNavigate()
  const [openQuickCreate, setOpenQuickCreate] = useState(false)
  const [quickFormState, setQuickFormState] = useState<QuickFormState>(quickFormInitialState)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loadingForm, setLoadingForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!openQuickCreate) {
      return
    }

    let active = true

    const loadQuickCreateForm = async () => {
      try {
        setLoadingForm(true)
        setError('')
        const [nextBranches, nextSubjects, referenceResponse] = await Promise.all([
          appApi.getBranches(),
          appApi.getSubjects(),
          appApi.getReferenceNumber(),
        ])

        if (!active) {
          return
        }

        setBranches(nextBranches)
        setSubjects(nextSubjects)
        setReferenceNumber(referenceResponse.referenceNumber)
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError))
        }
      } finally {
        if (active) {
          setLoadingForm(false)
        }
      }
    }

    void loadQuickCreateForm()

    return () => {
      active = false
    }
  }, [openQuickCreate])

  const closeQuickCreate = () => {
    setOpenQuickCreate(false)
    setQuickFormState(quickFormInitialState)
    setReferenceNumber('')
    setError('')
    setFieldErrors({})
  }

  const validateQuickForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!quickFormState.branchId) {
      nextErrors.branchId = 'Branch is required.'
    }

    if (!quickFormState.subjectId) {
      nextErrors.subjectId = 'Subject is required.'
    }

    if (!quickFormState.recordDate) {
      nextErrors.recordDate = 'Date is required.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleQuickCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!validateQuickForm()) {
      return
    }

    const formData = new FormData()
    formData.append('branchId', String(quickFormState.branchId))
    formData.append('subjectId', String(quickFormState.subjectId))
    formData.append('recordDate', quickFormState.recordDate)
    formData.append('remark', quickFormState.remark)

    try {
      setSaving(true)
      const record = await appApi.createRecord(formData)
      closeQuickCreate()
      navigate(`/records/${record.id}/workspace`)
    } catch (saveError) {
      setError(getApiErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white/95 px-8 px-20  py-20 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.35)]">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-80 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_62%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-96 opacity-70">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,transparent_22%,rgba(148,163,184,0.12)_23%,transparent_24%,transparent_31%,rgba(148,163,184,0.1)_32%,transparent_33%)]" />
        </div>

        <div className="relative">
          <div className="mb-10">
            <h1 className="text-[2rem] font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Phase-1 dashboard includes the approved workflow actions.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {dashboardCards.map((card) => {
              const Icon = card.icon
              const styles = cardStyles[card.color]
              const cardClassName = `group relative overflow-hidden rounded-[28px] border ${styles.border} bg-gradient-to-br ${styles.shell} p-7 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_50px_-30px_rgba(15,23,42,0.38)]`
              const cardContent = (
                <>
                  <div className={`pointer-events-none absolute bottom-0 right-0 h-24 w-56 bg-gradient-to-l ${styles.wave} [clip-path:ellipse(75%_85%_at_100%_100%)]`} />

                  <div className="relative flex items-center justify-between gap-5">
                    <div className={`flex h-[104px] w-[104px] items-center justify-center rounded-full ${styles.iconWrap}`}>
                      <Icon className="h-11 w-11 stroke-[1.8]" />
                    </div>

                    <div className="flex flex-1 items-start justify-between gap-6">
                      <div className="max-w-[320px] pt-2">
                        <h3 className="text-[1.75rem] font-semibold tracking-tight text-slate-900">{card.title}</h3>
                        <p className="mt-3 text-lg leading-8 text-slate-500">{card.description}</p>
                      </div>

                      <div className={`mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-white ${styles.arrowWrap} shadow-lg transition group-hover:translate-x-1`}>
                        <ArrowRight className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                </>
              )

              if (card.type === 'button') {
                return (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => setOpenQuickCreate(true)}
                    className={cardClassName}
                  >
                    {cardContent}
                  </button>
                )
              }

              return (
                <Link key={card.title} to={card.to} className={cardClassName}>
                  {cardContent}
                </Link>
              )
            })}
          </div>

          <div className="relative mt-8 overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)]">
            <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-64 bg-[radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_58%)]" />

            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-slate-900">Secure &amp; Reliable</span>
                  <span className="hidden text-slate-300 sm:inline">|</span>
                  <span className="text-slate-500">Your data is protected and access is monitored.</span>
                </div>
              </div>

              <div className="hidden items-center gap-2 text-blue-500 md:flex">
                <LockKeyhole className="h-10 w-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {openQuickCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="w-full max-w-4xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Add New Record</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Save the record metadata first. Document upload will continue on the next screen.
                </p>
              </div>
              <button
                type="button"
                onClick={closeQuickCreate}
                className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Close quick create popup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingForm ? (
              <div className="animate-pulse space-y-4">
                <div className="h-12 rounded-2xl bg-slate-100" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="h-12 rounded-2xl bg-slate-100" />
                  <div className="h-12 rounded-2xl bg-slate-100" />
                </div>
                <div className="h-40 rounded-3xl bg-slate-100" />
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleQuickCreate}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Reference Number</span>
                    <input
                      readOnly
                      value={referenceNumber}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Date</span>
                    <input
                      type="date"
                      value={quickFormState.recordDate}
                      onChange={(event) =>
                        setQuickFormState((current) => ({
                          ...current,
                          recordDate: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    />
                    {fieldErrors.recordDate ? (
                      <span className="mt-2 block text-xs text-red-600">{fieldErrors.recordDate}</span>
                    ) : null}
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <SearchableSelect
                    label="Branch"
                    placeholder="Select branch"
                    value={quickFormState.branchId}
                    options={branches}
                    error={fieldErrors.branchId}
                    onChange={(branchId) =>
                      setQuickFormState((current) => ({ ...current, branchId }))
                    }
                  />
                  <SearchableSelect
                    label="Subject"
                    placeholder="Select subject"
                    value={quickFormState.subjectId}
                    options={subjects}
                    error={fieldErrors.subjectId}
                    onChange={(subjectId) =>
                      setQuickFormState((current) => ({ ...current, subjectId }))
                    }
                  />
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Remark</span>
                  <textarea
                    value={quickFormState.remark}
                    onChange={(event) =>
                      setQuickFormState((current) => ({ ...current, remark: event.target.value }))
                    }
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    placeholder="Enter remark"
                  />
                </label>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeQuickCreate}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
