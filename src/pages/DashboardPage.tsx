import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Database, LogOut, Save, Search, Upload, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PageSection from '@/components/PageSection'
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

const dashboardOptions = [
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
      <PageSection
        title="Dashboard"
        description="Phase-1 dashboard includes the approved workflow actions."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setOpenQuickCreate(true)}
            className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-slate-300 hover:bg-white hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Database className="h-5 w-5" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-900" />
            </div>
            <h3 className="mt-6 text-base font-semibold text-slate-900">New Record Entry</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Start a new record in a popup, save the metadata, then continue on the record entry screen.
            </p>
          </button>

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
