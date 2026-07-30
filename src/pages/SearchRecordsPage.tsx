import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FilePenLine, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '@/components/ConfirmDialog'
import PageSection from '@/components/PageSection'
import SearchableSelect from '@/components/SearchableSelect'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appApi, getApiErrorMessage } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import type { BranchOption, RecordListItem, SubjectOption } from '../../shared/types'

type Filters = {
  branchId?: number
  subjectId?: number
  referenceNumber: string
  remarkKeywords: string
  dateFrom: string
  dateTo: string
}

const emptyFilters: Filters = {
  branchId: undefined,
  subjectId: undefined,
  referenceNumber: '',
  remarkKeywords: '',
  dateFrom: '',
  dateTo: '',
}

export default function SearchRecordsPage() {
  useDocumentTitle('Search Records')

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters)
  const [items, setItems] = useState<RecordListItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RecordListItem | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const loadResults = useCallback(async (activePage: number, nextFilters: Filters) => {
    try {
      setLoading(true)
      setError('')
      const result = await appApi.searchRecords({
        ...nextFilters,
        page: activePage,
        pageSize,
      })
      setItems(result.items)
      setTotalItems(result.totalItems)
      setTotalPages(result.totalPages)
    } catch (pageError) {
      setError(getApiErrorMessage(pageError))
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const [nextBranches, nextSubjects] = await Promise.all([
          appApi.getBranches(),
          appApi.getSubjects(),
        ])
        if (!active) {
          return
        }

        setBranches(nextBranches)
        setSubjects(nextSubjects)
      } catch (bootstrapError) {
        if (active) {
          setError(getApiErrorMessage(bootstrapError))
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    void loadResults(page, appliedFilters)
  }, [appliedFilters, loadResults, page])

  const paginationLabel = useMemo(() => {
    if (!totalItems) return 'No records found.'
    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, totalItems)
    return `Showing ${start}-${end} of ${totalItems} records`
  }, [page, pageSize, totalItems])

  const handleSearch = () => {
    setPage(1)
    setAppliedFilters(filters)
  }

  const handleReset = () => {
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }

    try {
      setDeleteBusy(true)
      await appApi.deleteRecord(deleteTarget.id)
      setDeleteTarget(null)
      await loadResults(page, appliedFilters)
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageSection
          title="Search Records"
          description="Use a single filter or combine multiple filters. Results are sorted by date in descending order."
          actions={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSearch}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SearchableSelect
              label="Branch"
              placeholder="All branches"
              value={filters.branchId}
              options={branches}
              onChange={(branchId) => setFilters((current) => ({ ...current, branchId }))}
            />
            <SearchableSelect
              label="Subject"
              placeholder="All subjects"
              value={filters.subjectId}
              options={subjects}
              onChange={(subjectId) => setFilters((current) => ({ ...current, subjectId }))}
            />
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Reference Number</span>
              <input
                value={filters.referenceNumber}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, referenceNumber: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="Enter reference number"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Remark Keywords</span>
              <input
                value={filters.remarkKeywords}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, remarkKeywords: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="Enter remark keywords"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Date From</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Date To</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateTo: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
          </div>
        </PageSection>

        <PageSection title="Search Results" description={paginationLabel}>
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    {[
                      'Reference Number',
                      'Branch',
                      'Subject',
                      'Date',
                      'Record File',
                      'Uploaded At',
                      'Modified At',
                      'Actions',
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                  {loading ? (
                    [...Array.from({ length: 5 })].map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="h-10 rounded-2xl bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  ) : items.length ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4 font-medium text-slate-900">
                          <Link to={`/records/${item.id}/view`} className="text-slate-900 underline-offset-4 hover:underline">
                            {item.referenceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-4">{item.branchName}</td>
                        <td className="px-4 py-4">{item.subjectName}</td>
                        <td className="px-4 py-4">{formatDate(item.recordDate)}</td>
                        <td className="px-4 py-4">{item.recordFileSummary}</td>
                        <td className="px-4 py-4">{formatDateTime(item.uploadedAt)}</td>
                        <td className="px-4 py-4">{formatDateTime(item.modifiedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to={`/records/${item.id}/view`}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium transition hover:bg-slate-50"
                            >
                              <Eye className="mr-1 inline h-3.5 w-3.5" />
                              View
                            </Link>
                            <Link
                              to={`/records/${item.id}/edit`}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                            >
                              <FilePenLine className="mr-1 inline h-3.5 w-3.5" />
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                            >
                              <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        No records matched the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">{paginationLabel}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </PageSection>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Record"
        description="This will permanently delete the database record and the complete folder of files."
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
