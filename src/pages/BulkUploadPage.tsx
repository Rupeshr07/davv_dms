import { Files } from 'lucide-react'
import PageSection from '@/components/PageSection'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function BulkUploadPage() {
  useDocumentTitle('Bulk Record Upload')

  return (
    <PageSection
      title="Bulk Record Upload"
      description="This Phase-1 route is included because it is an approved dashboard option."
    >
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="mx-auto inline-flex rounded-2xl bg-slate-900 p-3 text-white">
          <Files className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">Workflow reserved for approved bulk template</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          The current Phase-1 brief names Bulk Record Upload as a dashboard entry but does not define the upload mapping, validation matrix, or file batching rules. This page is intentionally limited so we do not invent extra functionality beyond the approved scope.
        </p>
      </div>
    </PageSection>
  )
}
