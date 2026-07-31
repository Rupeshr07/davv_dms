import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Folder, Minus, Plus, Scissors, RotateCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appApi, getApiErrorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RecordFile, RecordViewerResponse } from '../../shared/types'

type FolderSelection = {
  label: string
  path: string
}

const defaultInputFolder: FolderSelection = {
  label: 'Choose Folder',
  path: 'C:\\DAVV\\Input',
}

const defaultOutputFolder: FolderSelection = {
  label: 'Choose Folder',
  path: 'C:\\DAVV\\Output',
}

const buildFileUrl = (relativePath: string) =>
  `/${relativePath.startsWith('uploads/') ? relativePath : `uploads/${relativePath}`}`

function ProcessingDocumentPreview({
  file,
  zoom,
  rotation,
  cropped,
}: {
  file?: RecordFile
  zoom: number
  rotation: number
  cropped: boolean
}) {
  const previewStyle = {
    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
  }

  if (file && file.mimeType.startsWith('image/')) {
    return (
      <div className="flex min-h-[760px] items-start justify-center p-8">
        <div
          className={cn(
            'overflow-hidden rounded-sm bg-white shadow-[0_24px_55px_rgba(15,23,42,0.12)] transition-all',
            cropped ? 'w-[440px]' : 'w-[560px]',
          )}
        >
          <img
            src={buildFileUrl(file.relativePath)}
            alt={file.originalName}
            style={previewStyle}
            className="block w-full origin-top transition-transform duration-200"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[760px] items-start justify-center p-8">
      <div
        style={previewStyle}
        className={cn(
          'origin-top rounded-sm bg-white px-10 py-8 text-slate-800 shadow-[0_24px_55px_rgba(15,23,42,0.12)] transition-all duration-200',
          cropped ? 'w-[440px]' : 'w-[560px]',
        )}
      >
        <div className="text-center">
          <h2 className="text-[15px] font-bold tracking-wide text-slate-900">PURCHASE ORDER</h2>
        </div>

        <div className="mt-10 flex items-start justify-between text-[11px] leading-5">
          <div>
            <p className="font-semibold">To,</p>
            <p>XYZ SUPPLIERS</p>
            <p>125, Industrial Area,</p>
            <p>New Delhi - 110001</p>
          </div>
          <div className="text-right">
            <p>
              <span className="font-semibold">PO No.:</span> PO-5621
            </p>
            <p>
              <span className="font-semibold">Date:</span> 20/05/2024
            </p>
            <p>
              <span className="font-semibold">Delivery Date:</span> 27/05/2024
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden border border-slate-300">
          <div className="grid grid-cols-[60px_1.4fr_90px_90px_110px] border-b border-slate-300 bg-slate-50 text-[10px] font-semibold">
            <div className="border-r border-slate-300 px-2 py-2">Sr. No.</div>
            <div className="border-r border-slate-300 px-2 py-2">Description</div>
            <div className="border-r border-slate-300 px-2 py-2">Quantity</div>
            <div className="border-r border-slate-300 px-2 py-2">Unit Price</div>
            <div className="px-2 py-2">Amount</div>
          </div>
          {[
            ['1', 'Item Description 1', '10', 'Rs.500.00', 'Rs.5,000.00'],
            ['2', 'Item Description 2', '20', 'Rs.300.00', 'Rs.6,000.00'],
            ['3', 'Item Description 3', '15', 'Rs.200.00', 'Rs.3,000.00'],
          ].map((row) => (
            <div
              key={row[0]}
              className="grid grid-cols-[60px_1.4fr_90px_90px_110px] border-b border-slate-300 text-[10px]"
            >
              {row.map((cell, index) => (
                <div
                  key={`${row[0]}-${index}`}
                  className={cn('px-2 py-2', index < row.length - 1 && 'border-r border-slate-300')}
                >
                  {cell}
                </div>
              ))}
            </div>
          ))}
          {[
            ['Sub Total', 'Rs.14,000.00'],
            ['GST (18%)', 'Rs.2,520.00'],
            ['Total', 'Rs.16,520.00'],
          ].map((row, index) => (
            <div key={row[0]} className="grid grid-cols-[60px_1.4fr_90px_90px_110px] text-[10px]">
              <div className={cn('border-r border-slate-300 px-2 py-2', index < 2 && 'border-b border-slate-300')} />
              <div className={cn('border-r border-slate-300 px-2 py-2', index < 2 && 'border-b border-slate-300')} />
              <div className={cn('border-r border-slate-300 px-2 py-2', index < 2 && 'border-b border-slate-300')} />
              <div className={cn('border-r border-slate-300 px-2 py-2 font-semibold', index < 2 && 'border-b border-slate-300')}>
                {row[0]}
              </div>
              <div className={cn('px-2 py-2 font-semibold', index < 2 && 'border-b border-slate-300')}>
                {row[1]}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-[11px] leading-6">
          <p className="font-semibold">Terms & Conditions</p>
          <p>1. Payment within 30 days.</p>
          <p>2. Goods once sold will not be taken back.</p>
        </div>

        <div className="mt-16 flex justify-end">
          <div className="w-32 text-center text-[11px]">
            <div className="border-t border-slate-400 pt-2">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecordWorkspacePage() {
  const { recordId = '' } = useParams()
  const navigate = useNavigate()

  useDocumentTitle('Add New Record Workspace')

  const [viewerData, setViewerData] = useState<RecordViewerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [cropped, setCropped] = useState(false)
  const [inputFolder, setInputFolder] = useState<FolderSelection>(defaultInputFolder)
  const [outputFolder, setOutputFolder] = useState<FolderSelection>(defaultOutputFolder)

  const inputFolderRef = useRef<HTMLInputElement | null>(null)
  const outputFolderRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let active = true

    const loadWorkspace = async () => {
      try {
        setLoading(true)
        const data = await appApi.getViewer(recordId)
        if (!active) {
          return
        }

        setViewerData(data)
        setActiveIndex(0)
      } catch (workspaceError) {
        if (active) {
          setError(getApiErrorMessage(workspaceError))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadWorkspace()

    return () => {
      active = false
    }
  }, [recordId])

  const files = useMemo(() => viewerData?.record.files ?? [], [viewerData])
  const activeFile = files[activeIndex]
  const totalDocuments = Math.max(files.length, 1)

  const handleFolderChange =
    (setter: (value: FolderSelection) => void, fallback: FolderSelection) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const firstFile = event.target.files?.[0]
      if (!firstFile) {
        setter(fallback)
        return
      }

      const relativePath = 'webkitRelativePath' in firstFile ? firstFile.webkitRelativePath : ''
      const folderName = relativePath ? relativePath.split('/')[0] : firstFile.name

      setter({
        label: folderName || fallback.label,
        path: folderName ? `Selected folder: ${folderName}` : fallback.path,
      })
    }

  const handlePrevious = () => {
    if (!files.length) {
      return
    }

    setActiveIndex((current) => (current === 0 ? files.length - 1 : current - 1))
  }

  const handleNext = () => {
    if (!files.length) {
      return
    }

    setActiveIndex((current) => (current === files.length - 1 ? 0 : current + 1))
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 rounded-[28px] bg-white/70" />
        <div className="h-[760px] rounded-[32px] bg-white/70" />
      </div>
    )
  }

  if (error || !viewerData) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error || 'The add new record workspace could not be loaded.'}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Back to Dashboard
        </Link>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Reference No: {viewerData.record.referenceNumber}</span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="font-semibold text-slate-900">Branch:</span> {viewerData.record.branchName}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="font-semibold text-slate-900">Subject:</span> {viewerData.record.subjectName}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span>
              <span className="font-semibold text-slate-900">Date:</span> {formatDate(viewerData.record.recordDate)}
            </span>
            <span className="hidden text-slate-300 md:inline">|</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-slate-900">Remark:</span> {viewerData.record.remark || '-'}
            </span>
          </div>
        </div>

        <div className="grid xl:grid-cols-[240px_minmax(0,1fr)_220px]">
          <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b border-slate-200 px-5 py-5">
              <h2 className="text-[28px] font-semibold tracking-tight text-slate-900">Folders</h2>
            </div>

            <div className="space-y-8 px-5 py-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Input Folder</h3>
                <input
                  ref={(node) => {
                    inputFolderRef.current = node
                    if (node) {
                      node.setAttribute('webkitdirectory', '')
                      node.setAttribute('directory', '')
                    }
                  }}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFolderChange(setInputFolder, defaultInputFolder)}
                />
                <button
                  type="button"
                  onClick={() => inputFolderRef.current?.click()}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Folder className="h-5 w-5 text-amber-500" />
                  {inputFolder.label}
                </button>
                <p className="break-all text-sm text-slate-500">{inputFolder.path}</p>
              </div>

              <div className="border-t border-slate-200 pt-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Output Folder</h3>
                  <input
                    ref={(node) => {
                      outputFolderRef.current = node
                      if (node) {
                        node.setAttribute('webkitdirectory', '')
                        node.setAttribute('directory', '')
                      }
                    }}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFolderChange(setOutputFolder, defaultOutputFolder)}
                  />
                  <button
                    type="button"
                    onClick={() => outputFolderRef.current?.click()}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Folder className="h-5 w-5 text-amber-500" />
                    {outputFolder.label}
                  </button>
                  <p className="break-all text-sm text-slate-500">{outputFolder.path}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/records/${viewerData.record.id}/edit`)}
                className="w-full rounded-2xl bg-[#032760] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#042049]"
              >
                Start Processing
              </button>
            </div>
          </aside>

          <div className="border-b border-slate-200 bg-slate-100 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-center justify-center gap-4 border-b border-slate-200 px-5 py-4 text-sm font-medium text-slate-700">
              <span>
                Document {Math.min(activeIndex + 1, totalDocuments)} / {totalDocuments}
              </span>

              <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.max(current - 10, 50))}
                  className="px-4 py-2 text-slate-600 transition hover:bg-slate-50"
                  aria-label="Zoom out"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-20 border-x border-slate-200 px-4 py-2 text-center">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.min(current + 10, 200))}
                  className="px-4 py-2 text-slate-600 transition hover:bg-slate-50"
                  aria-label="Zoom in"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ProcessingDocumentPreview
              file={activeFile}
              zoom={zoom}
              rotation={rotation}
              cropped={cropped}
            />
          </div>

          <aside className="px-5 py-6">
            <div>
              <h2 className="text-[28px] font-semibold tracking-tight text-slate-900">Navigation</h2>
              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={!files.length}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!files.length}
                  className="w-full rounded-2xl bg-[#032760] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#042049] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Escape
                </button>
              </div>
            </div>

            <div className="mt-12">
              <h2 className="text-[28px] font-semibold tracking-tight text-slate-900">Tools</h2>
              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={() => setCropped((current) => !current)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Scissors className="h-4 w-4" />
                  Crop
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((current) => (current + 90) % 360)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RotateCw className="h-4 w-4" />
                  Rotate
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
