import { FileText, ImageIcon } from 'lucide-react'
import type { RecordFile } from '../../shared/types'

type RecordViewerProps = {
  file?: RecordFile
}

export default function RecordViewer({ file }: RecordViewerProps) {
  if (!file) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Select a file from the left panel to preview it here.
      </div>
    )
  }

  const fileUrl = `/${file.relativePath.startsWith('uploads/') ? file.relativePath : `uploads/${file.relativePath}`}`

  if (file.mimeType === 'application/pdf') {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          <FileText className="h-4 w-4 text-red-500" />
          {file.originalName}
        </div>
        <iframe src={fileUrl} title={file.originalName} className="h-[720px] w-full" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
        <ImageIcon className="h-4 w-4 text-blue-500" />
        {file.originalName}
      </div>
      <div className="flex min-h-[720px] items-center justify-center bg-slate-50 p-6">
        <img src={fileUrl} alt={file.originalName} className="max-h-[660px] rounded-2xl shadow-lg" />
      </div>
    </div>
  )
}
