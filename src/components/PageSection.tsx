import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageSectionProps = PropsWithChildren<{
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}>

export default function PageSection({
  title,
  description,
  actions,
  className,
  children,
}: PageSectionProps) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]',
        className,
      )}
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
