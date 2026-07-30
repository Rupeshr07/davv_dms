import { FileText, Image, Upload, X } from 'lucide-react'
import { formatBytes } from '@/lib/format'
import type { RecordFile } from '../../shared/types'

type FileUploadFieldProps = {
  selectedFiles: File[]
  existingFiles?: RecordFile[]
  removedFileIds: string[]
  onFilesChange: (files: File[]) => void
  onToggleRemoveExisting: (fileId: string) => void
  error?: string
}

const iconForMime = (mimeType: string) =>
  mimeType === 'application/pdf' ? (
    <FileText className="h-4 w-4 text-red-500" />
  ) : (
    <Image className="h-4 w-4 text-blue-500" />
  )

export default function FileUploadField({
  selectedFiles,
  existingFiles = [],
  removedFileIds,
  onFilesChange,
  onToggleRemoveExisting,
  error,
}: FileUploadFieldProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-900 p-3 text-white">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Upload record documents</p>
            <p className="text-xs text-slate-500">Allowed formats: PDF, PNG, JPEG</p>
          </div>
        </div>
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
          className="mt-4 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      {existingFiles.length ? (
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-800">Existing uploaded files</p>
          <div className="space-y-2">
            {existingFiles.map((file) => {
              const markedForRemoval = removedFileIds.includes(file.id)
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {iconForMime(file.mimeType)}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{file.originalName}</p>
                      <p className="text-xs text-slate-500">{formatBytes(file.sizeBytes)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleRemoveExisting(file.id)}
                    className={[
                      'rounded-xl px-3 py-2 text-xs font-medium transition',
                      markedForRemoval
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {markedForRemoval ? 'Marked for removal' : 'Remove on update'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {selectedFiles.length ? (
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-800">New selected files</p>
          <div className="space-y-2">
            {selectedFiles.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {iconForMime(file.type)}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onFilesChange(selectedFiles.filter((item) => item !== file))
                  }
                  className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
