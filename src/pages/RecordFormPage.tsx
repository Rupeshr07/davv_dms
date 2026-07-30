import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import PageSection from '@/components/PageSection'
import SearchableSelect from '@/components/SearchableSelect'
import FileUploadField from '@/components/FileUploadField'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appApi, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import type { BranchOption, RecordFile, SubjectOption } from '../../shared/types'

type FormState = {
  branchId?: number
  subjectId?: number
  recordDate: string
  remark: string
}

const initialFormState: FormState = {
  branchId: undefined,
  subjectId: undefined,
  recordDate: new Date().toISOString().slice(0, 10),
  remark: '',
}

export default function RecordFormPage() {
  const { recordId } = useParams()
  const isEditMode = Boolean(recordId)
  useDocumentTitle(isEditMode ? 'Edit Record' : 'Add New Record')

  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [existingFiles, setExistingFiles] = useState<RecordFile[]>([])
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true

    const loadPage = async () => {
      try {
        setLoading(true)
        const [nextBranches, nextSubjects] = await Promise.all([
          appApi.getBranches(),
          appApi.getSubjects(),
        ])

        if (!active) {
          return
        }

        setBranches(nextBranches)
        setSubjects(nextSubjects)

        if (isEditMode && recordId) {
          const record = await appApi.getRecord(recordId)
          if (!active) {
            return
          }

          setReferenceNumber(record.referenceNumber)
          setExistingFiles(record.files)
          setFormState({
            branchId: record.branchId,
            subjectId: record.subjectId,
            recordDate: record.recordDate,
            remark: record.remark,
          })
        } else {
          const { referenceNumber: nextReference } = await appApi.getReferenceNumber()
          if (!active) {
            return
          }

          setReferenceNumber(nextReference)
          setFormState(initialFormState)
        }
      } catch (pageError) {
        if (active) {
          setError(getApiErrorMessage(pageError))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      active = false
    }
  }, [isEditMode, recordId])

  const infoRows = useMemo(
    () => [
      ['Logged In Staff ID', user?.staffId ?? '-'],
      ['Created At', isEditMode ? 'System managed' : 'Generated on save'],
      ['Updated At', 'System managed'],
      ['Record Status', 'ACTIVE'],
      ['Total Number Of Pages', 'System managed'],
      ['Document Type', 'System managed'],
      ['Document Size', 'System managed'],
      ['Directory Name', 'System managed'],
    ],
    [isEditMode, user?.staffId],
  )

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!formState.branchId) nextErrors.branchId = 'Branch is required.'
    if (!formState.subjectId) nextErrors.subjectId = 'Subject is required.'
    if (!formState.recordDate) nextErrors.recordDate = 'Date is required.'

    const remainingExistingFiles = existingFiles.filter(
      (file) => !removedFileIds.includes(file.id),
    )
    if (!selectedFiles.length && !remainingExistingFiles.length) {
      nextErrors.files = 'At least one file is required.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!validate()) {
      return
    }

    const formData = new FormData()
    formData.append('branchId', String(formState.branchId))
    formData.append('subjectId', String(formState.subjectId))
    formData.append('recordDate', formState.recordDate)
    formData.append('remark', formState.remark)
    formData.append('removeFileIds', JSON.stringify(removedFileIds))
    selectedFiles.forEach((file) => formData.append('files', file))

    try {
      setSaving(true)
      const record = isEditMode && recordId
        ? await appApi.updateRecord(recordId, formData)
        : await appApi.createRecord(formData)
      navigate(`/records/${record.id}/view`)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageSection title={isEditMode ? 'Edit Record' : 'Add New Record'}>
        <div className="animate-pulse space-y-4">
          <div className="h-12 rounded-2xl bg-slate-100" />
          <div className="h-40 rounded-3xl bg-slate-100" />
          <div className="h-64 rounded-3xl bg-slate-100" />
        </div>
      </PageSection>
    )
  }

  return (
    <div className="space-y-6">
      <PageSection
        title={isEditMode ? 'Edit Record' : 'Add New Record'}
        description="The editable form matches the approved Phase-1 metadata scope."
        actions={
          <Link
            to="/records/search"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        }
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
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
                value={formState.recordDate}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, recordDate: event.target.value }))
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
              value={formState.branchId}
              options={branches}
              error={fieldErrors.branchId}
              onChange={(branchId) => setFormState((current) => ({ ...current, branchId }))}
            />
            <SearchableSelect
              label="Subject"
              placeholder="Select subject"
              value={formState.subjectId}
              options={subjects}
              error={fieldErrors.subjectId}
              onChange={(subjectId) => setFormState((current) => ({ ...current, subjectId }))}
            />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Remark</span>
            <textarea
              value={formState.remark}
              onChange={(event) =>
                setFormState((current) => ({ ...current, remark: event.target.value }))
              }
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="Enter remark"
            />
          </label>

          <FileUploadField
            selectedFiles={selectedFiles}
            existingFiles={existingFiles}
            removedFileIds={removedFileIds}
            onFilesChange={setSelectedFiles}
            onToggleRemoveExisting={(fileId) =>
              setRemovedFileIds((current) =>
                current.includes(fileId)
                  ? current.filter((item) => item !== fileId)
                  : [...current, fileId],
              )
            }
            error={fieldErrors.files}
          />

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : isEditMode ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection
        title="System Managed Fields"
        description="These values are maintained automatically and are not editable by users."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {infoRows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  )
}
