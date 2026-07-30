import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type Option = {
  id: number
  name: string
}

type SearchableSelectProps = {
  label: string
  placeholder: string
  value?: number
  options: Option[]
  error?: string
  onChange: (nextValue: number) => void
}

export default function SearchableSelect({
  label,
  placeholder,
  value,
  options,
  error,
  onChange,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    if (!query.trim()) {
      return options
    }

    return options.filter((option) => option.name.toLowerCase().includes(query.toLowerCase()))
  }, [options, query])

  return (
    <label className="relative block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left text-sm text-slate-700 transition',
          error ? 'border-red-300' : 'border-slate-200 hover:border-slate-300',
        )}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected?.name ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <span>{option.name}</span>
                  {option.id === value ? <Check className="h-4 w-4 text-blue-600" /> : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">No matching options.</p>
            )}
          </div>
        </div>
      ) : null}

      {error ? <span className="mt-2 block text-xs text-red-600">{error}</span> : null}
    </label>
  )
}
