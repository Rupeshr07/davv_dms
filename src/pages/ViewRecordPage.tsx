import { useEffect, useMemo, useState } from 'react'
import { Download, FileDigit, FolderTree } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageSection from '@/components/PageSection'
import RecordViewer from '@/components/RecordViewer'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appApi, getApiErrorMessage } from '@/lib/api'
import { formatBytes, formatDate, formatDateTime } from '@/lib/format'
import type { RecordFile, RecordViewerResponse } from '../../shared/types'

export default function ViewRecordPage() {
  const { recordId = '' } = useParams()
  useDocumentTitle('View Record File')

  const [viewerData, setViewerData] = useState<RecordViewerResponse | null>(null)
  const [activeFile, setActiveFile] = useState<RecordFile | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadViewer = async () => {
      try {
        setLoading(true)
        const data = await appApi.getViewer(recordId)
        if (!active) {
          return
        }

        setViewerData(data)
        setActiveFile(data.categories[0]?.files[0])
      } catch (viewerError) {
        if (active) {
          setError(getApiErrorMessage(viewerError))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadViewer()

    return () => {
      active = false
    }
  }, [recordId])

  const detailRows = useMemo(() => {
    if (!viewerData) {
      return []
    }

    const { record } = viewerData
    return [
      ['Reference Number', record.referenceNumber],
      ['Branch', record.branchName],
      ['Subject', record.subjectName],
      ['Date', formatDate(record.recordDate)],
      ['Remark', record.remark || '-'],
      ['Record Status', record.recordStatus],
      ['Total Pages', String(record.totalPages)],
      ['Document Type', record.documentType],
      ['Document Size', formatBytes(record.documentSizeBytes)],
      ['Created At', formatDateTime(record.createdAt)],
      ['Updated At', formatDateTime(record.updatedAt)],
    ]
  }, [viewerData])

  if (loading) {
    return (
      <PageSection title="View Record File">
        <div className="animate-pulse space-y-4">
          <div className="h-16 rounded-3xl bg-slate-100" />
          <div className="h-[720px] rounded-3xl bg-slate-100" />
        </div>
      </PageSection>
    )
  }

  if (error || !viewerData) {
    return (
      <PageSection title="View Record File">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Viewer data could not be loaded.'}
        </div>
      </PageSection>
    )
  }

  return (
    <div className="space-y-6">
      <PageSection
        title="Record Details"
        description="Record metadata and file viewer for the selected document set."
        actions={
          <div className="flex gap-3">
            <a
              href={appApi.buildDownloadUrl(viewerData.record.id)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download ZIP
            </a>
            <Link
              to={`/records/${viewerData.record.id}/edit`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Edit Record
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detailRows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <PageSection
          title="Category Selection Panel"
          description="Use the left panel for quick file switching."
        >
          <div className="space-y-5">
            {viewerData.categories.map((category) => (
              <div key={category.id}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <FolderTree className="h-4 w-4 text-slate-400" />
                  {category.label}
                </div>
                <div className="space-y-2">
                  {category.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setActiveFile(file)}
                      className={[
                        'w-full rounded-2xl border px-4 py-3 text-left text-sm transition',
                        activeFile?.id === file.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <FileDigit className="h-4 w-4" />
                        <span className="font-medium">{file.originalName}</span>
                      </div>
                      <p className="mt-2 text-xs opacity-80">{formatBytes(file.sizeBytes)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection title="File Viewer" description="PDF and image documents are rendered directly in the browser.">
          <RecordViewer file={activeFile} />
        </PageSection>
      </div>
    </div>
  )
}
