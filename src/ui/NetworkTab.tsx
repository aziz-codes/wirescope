import { useMemo, useState } from 'react'
import type { StoreSnapshot } from '../core/store'
import { store } from '../core/interceptor'
import { formatBytes, formatDuration, formatTime, splitUrl } from '../core/utils'
import type { NetworkEntry } from '../types'
import { NetworkIcon, PauseIcon, RecordIcon, SearchIcon, TrashIcon } from './icons'
import { cx, EmptyState, IconButton, MethodBadge, statusTone } from './primitives'
import { RequestDetail } from './RequestDetail'

type Filter = 'all' | 'pending' | 'success' | 'errors'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'success', label: '2xx/3xx' },
  { id: 'errors', label: 'Errors' },
]

function matchesFilter(entry: NetworkEntry, filter: Filter) {
  if (filter === 'pending') return entry.state === 'pending'
  if (filter === 'success') return entry.state === 'success'
  if (filter === 'errors') return entry.state === 'error' || entry.state === 'failed'
  return true
}

function StateDot({ entry }: { entry: NetworkEntry }) {
  if (entry.state === 'pending') {
    return (
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
      </span>
    )
  }
  return (
    <span
      className={cx(
        'size-2 rounded-full',
        entry.state === 'success' ? 'bg-emerald-400' : entry.state === 'error' ? 'bg-orange-400' : 'bg-rose-500',
      )}
    />
  )
}

function SourceTag({ source }: { source: NetworkEntry['source'] }) {
  if (source === 'fetch') return null
  return (
    <span
      className={cx(
        'shrink-0 rounded px-1 py-px font-mono text-[9.5px] font-medium tracking-wide uppercase',
        source === 'explorer' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-zinc-400',
      )}
    >
      {source}
    </span>
  )
}

export function NetworkTab({
  snapshot,
  selectedId,
  onSelect,
  onReplay,
  onOpenInExplorer,
}: {
  snapshot: StoreSnapshot
  selectedId: string | null
  onSelect: (id: string | null) => void
  onReplay: (entry: NetworkEntry) => void
  onOpenInExplorer: (entry: NetworkEntry) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const { entries, paused } = snapshot

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => matchesFilter(e, filter))
      .filter((e) => !q || `${e.method} ${e.url} ${e.status ?? ''}`.toLowerCase().includes(q))
      .reverse()
  }, [entries, filter, query])

  const selected = selectedId ? entries.find((e) => e.id === selectedId) : undefined
  const counts = useMemo(
    () => ({
      errors: entries.filter((e) => e.state === 'error' || e.state === 'failed').length,
      pending: entries.filter((e) => e.state === 'pending').length,
    }),
    [entries],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <label className="flex h-7 min-w-40 flex-1 items-center gap-2 rounded-md bg-white/[0.04] px-2 ring-1 ring-white/[0.07] ring-inset focus-within:ring-emerald-400/50 sm:max-w-72">
          <SearchIcon size={13} className="text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by URL, method, status"
            className="h-full w-full bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </label>
        <div className="flex items-center gap-0.5 rounded-md bg-white/[0.03] p-0.5 ring-1 ring-white/[0.06] ring-inset">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cx(
                'inline-flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors',
                filter === f.id ? 'bg-white/10 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {f.label}
              {f.id === 'errors' && counts.errors > 0 && (
                <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] text-rose-300">{counts.errors}</span>
              )}
              {f.id === 'pending' && counts.pending > 0 && (
                <span className="rounded-full bg-amber-400/15 px-1.5 text-[10px] text-amber-200">{counts.pending}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[11px] text-zinc-500 tabular-nums">
            {visible.length === entries.length ? entries.length : `${visible.length} / ${entries.length}`} requests
          </span>
          <IconButton
            label={paused ? 'Resume recording' : 'Pause recording'}
            onClick={() => store.setPaused(!paused)}
            className={paused ? 'text-zinc-400' : 'text-rose-400 hover:text-rose-300'}
          >
            {paused ? <PauseIcon size={13} /> : <RecordIcon size={13} />}
          </IconButton>
          <IconButton
            label="Clear requests"
            onClick={() => {
              store.clear()
              onSelect(null)
            }}
          >
            <TrashIcon size={14} />
          </IconButton>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className={cx('@container ws-scroll min-h-0 overflow-auto', selected ? 'hidden md:block md:w-[44%] md:border-r md:border-white/[0.07]' : 'w-full')}>
          {visible.length === 0 ? (
            <EmptyState
              icon={<NetworkIcon size={18} />}
              title={entries.length ? 'No requests match' : paused ? 'Recording is paused' : 'Listening for requests…'}
              hint={entries.length ? 'Try a different filter.' : 'fetch and XHR calls made by your app show up here as they happen.'}
            />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {visible.map((entry) => {
                const { origin, path, sameOrigin } = splitUrl(entry.url)
                const isSelected = entry.id === selectedId
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(isSelected ? null : entry.id)}
                      className={cx(
                        'flex w-full cursor-pointer items-center gap-2.5 px-3 py-[7px] text-left transition-colors',
                        isSelected ? 'bg-emerald-400/[0.08] shadow-[inset_2px_0_0] shadow-emerald-400' : 'hover:bg-white/[0.03]',
                      )}
                    >
                      <StateDot entry={entry} />
                      <MethodBadge method={entry.method} />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate font-mono text-[12px] text-zinc-200" title={entry.url}>
                          {!sameOrigin && <span className="text-zinc-500">{origin}</span>}
                          {path}
                        </span>
                        <SourceTag source={entry.source} />
                      </span>
                      <span className={cx('w-10 shrink-0 text-right font-mono text-[11.5px] tabular-nums', statusTone(entry.status, entry.state === 'failed'))}>
                        {entry.state === 'failed' ? 'ERR' : (entry.status ?? '···')}
                      </span>
                      <span className="hidden w-16 shrink-0 text-right text-[11px] text-zinc-400 tabular-nums @md:block">
                        {formatDuration(entry.duration)}
                      </span>
                      <span className="hidden w-16 shrink-0 text-right text-[11px] text-zinc-500 tabular-nums @xl:block">
                        {formatBytes(entry.size)}
                      </span>
                      <span className="hidden w-[84px] shrink-0 text-right font-mono text-[10.5px] text-zinc-600 tabular-nums @3xl:block">
                        {formatTime(entry.startedAt)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {selected && (
          <div className="min-h-0 flex-1 animate-fade">
            <RequestDetail
              key={selected.id}
              entry={selected}
              onClose={() => onSelect(null)}
              onReplay={onReplay}
              onOpenInExplorer={onOpenInExplorer}
            />
          </div>
        )}
      </div>
    </div>
  )
}
