import { useMemo, useRef, useState, type ReactNode } from 'react'
import { sendExplorerRequest } from '../core/interceptor'
import { usePersistentState } from '../core/storage'
import { formatBytes, formatDuration, formatTime, tryParseJson, uid } from '../core/utils'
import type { HttpMethod, NetworkEntry, WireScopeEndpoint } from '../types'
import { BodyView } from './BodyView'
import {
  buildRequest,
  draftFromEndpoint,
  draftFromEntry,
  hasBody,
  METHODS,
  templatePath,
  type ExplorerDraft,
  type HistoryItem,
  type SavedItem,
} from './explorer-model'
import { BookmarkIcon, CloseIcon, CompassIcon, GlobeIcon, ResetIcon, SearchIcon, SendIcon, SidebarIcon } from './icons'
import { KeyValueEditor } from './KeyValueEditor'
import {
  Button,
  cx,
  EmptyState,
  IconButton,
  KeyValueTable,
  MethodBadge,
  methodText,
  SectionTitle,
  StatusPill,
  Tabs,
} from './primitives'

type RequestTab = 'params' | 'headers' | 'body' | 'auth'

export interface BaseUrlState {
  value: string
  source: 'prop' | 'env' | 'custom' | 'origin'
  set: (value: string) => void
  reset: () => void
}

function Count({ n }: { n: number }) {
  return n ? <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-300">{n}</span> : null
}

function SidebarGroup({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="py-2">
      <div className="flex items-center justify-between px-3 pb-1">
        <h4 className="text-[10px] font-semibold tracking-[0.08em] text-zinc-500 uppercase">{title}</h4>
        {action}
      </div>
      <ul>{children}</ul>
    </section>
  )
}

function SidebarItem({
  method,
  label,
  meta,
  onClick,
  onRemove,
}: {
  method: string
  label: string
  meta?: ReactNode
  onClick: () => void
  onRemove?: () => void
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.04]"
      >
        <span className={cx('w-11 shrink-0 font-mono text-[10px] font-semibold', methodText(method))}>{method}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-zinc-300" title={label}>
          {label}
        </span>
        {meta && <span className="shrink-0 text-[10px] text-zinc-600 tabular-nums group-hover:opacity-0">{meta}</span>}
      </button>
      {onRemove && (
        <IconButton label="Remove" onClick={onRemove} className="absolute top-0.5 right-1 hidden size-6 group-hover:inline-flex">
          <CloseIcon size={12} />
        </IconButton>
      )}
    </li>
  )
}

export function ExplorerTab({
  draft,
  setDraft,
  baseUrl,
  endpoints,
  entries,
}: {
  draft: ExplorerDraft
  setDraft: (draft: ExplorerDraft | ((d: ExplorerDraft) => ExplorerDraft)) => void
  baseUrl: BaseUrlState
  endpoints: WireScopeEndpoint[]
  entries: NetworkEntry[]
}) {
  const [tab, setTab] = useState<RequestTab>('params')
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body')
  const [response, setResponse] = useState<NetworkEntry | null>(null)
  const [sending, setSending] = useState(false)
  const [history, setHistory] = usePersistentState<HistoryItem[]>('history', [])
  const [saved, setSaved] = usePersistentState<SavedItem[]>('saved', [])
  const [showSidebar, setShowSidebar] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900)
  const [sidebarQuery, setSidebarQuery] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const request = useMemo(() => buildRequest(draft, baseUrl.value), [draft, baseUrl.value])
  const update = (patch: Partial<ExplorerDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const bodyInvalid = draft.bodyType === 'json' && draft.body.trim() !== '' && !tryParseJson(draft.body).ok

  const send = async () => {
    if (sending || !draft.endpoint.trim()) return
    const controller = new AbortController()
    abortRef.current = controller
    setSending(true)
    const entry = await sendExplorerRequest({ ...request, signal: controller.signal })
    abortRef.current = null
    setSending(false)
    setResponse(entry)
    setHistory((h) =>
      [{ id: uid(), at: entry.startedAt, status: entry.status, failed: entry.state === 'failed', duration: entry.duration, draft }, ...h].slice(0, 30),
    )
  }

  const save = () => {
    const name = `${draft.method} ${draft.endpoint}`
    setSaved((s) => [{ id: uid(), name, draft }, ...s.filter((item) => item.name !== name)])
  }

  // App traffic grouped by method + templated path, e.g. GET /users/:id.
  const discovered = useMemo(() => {
    const groups = new Map<string, { method: string; template: string; url: string; count: number }>()
    const base = baseUrl.value.replace(/\/+$/, '')
    for (const e of entries) {
      if (e.source === 'explorer') continue
      let path = e.url
      try {
        const u = new URL(e.url)
        const full = `${u.origin}${u.pathname}`
        path = base && full.startsWith(base) ? full.slice(base.length) || '/' : full
      } catch {
        /* keep raw */
      }
      const template = templatePath(path)
      const key = `${e.method} ${template}`
      const group = groups.get(key)
      if (group) {
        group.count++
        group.url = e.url
      } else groups.set(key, { method: e.method, template, url: e.url, count: 1 })
    }
    return [...groups.values()]
  }, [entries, baseUrl.value])

  const q = sidebarQuery.trim().toLowerCase()
  const match = (method: string, label: string) => !q || `${method} ${label}`.toLowerCase().includes(q)

  const reqTabs: Array<{ id: RequestTab; label: ReactNode }> = [
    { id: 'params', label: <>Params <Count n={draft.params.filter((p) => p.enabled && p.key).length} /></> },
    { id: 'headers', label: <>Headers <Count n={draft.headers.filter((h) => h.enabled && h.key).length} /></> },
    { id: 'body', label: <>Body {hasBody(draft.method) && draft.body.trim() && <span className="size-1.5 rounded-full bg-emerald-400" />}</> },
    { id: 'auth', label: <>Auth {draft.bearer && <span className="size-1.5 rounded-full bg-emerald-400" />}</> },
  ]

  return (
    <div className="flex h-full min-h-0">
      {showSidebar && (
        <aside className="ws-scroll flex w-60 shrink-0 animate-fade flex-col overflow-y-auto border-r border-white/[0.07] bg-black/20">
          <div className="sticky top-0 z-10 bg-zinc-950/95 p-2 backdrop-blur">
            <label className="flex h-7 items-center gap-2 rounded-md bg-white/[0.04] px-2 ring-1 ring-white/[0.07] ring-inset focus-within:ring-emerald-400/50">
              <SearchIcon size={12} className="text-zinc-500" />
              <input
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                placeholder="Find endpoint"
                className="h-full w-full bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </label>
          </div>

          {endpoints.length > 0 && (
            <SidebarGroup title="Endpoints">
              {endpoints
                .filter((ep) => match(ep.method ?? 'GET', ep.name ?? ep.path))
                .map((ep) => (
                  <SidebarItem
                    key={`${ep.method} ${ep.path} ${ep.name}`}
                    method={ep.method ?? 'GET'}
                    label={ep.name ?? ep.path}
                    onClick={() => setDraft((d) => draftFromEndpoint(ep, d))}
                  />
                ))}
            </SidebarGroup>
          )}

          {saved.length > 0 && (
            <SidebarGroup title="Saved">
              {saved
                .filter((s) => match(s.draft.method, s.draft.endpoint))
                .map((s) => (
                  <SidebarItem
                    key={s.id}
                    method={s.draft.method}
                    label={s.draft.endpoint}
                    onClick={() => setDraft(s.draft)}
                    onRemove={() => setSaved((all) => all.filter((x) => x.id !== s.id))}
                  />
                ))}
            </SidebarGroup>
          )}

          <SidebarGroup title="Discovered">
            {discovered.length === 0 ? (
              <p className="px-3 py-1 text-[11px] text-zinc-600">Endpoints your app calls appear here.</p>
            ) : (
              discovered
                .filter((d) => match(d.method, d.template))
                .map((d) => (
                  <SidebarItem
                    key={`${d.method} ${d.template}`}
                    method={d.method}
                    label={d.template}
                    meta={`×${d.count}`}
                    onClick={() => {
                      const latest = [...entries].reverse().find((e) => e.url === d.url && e.method === d.method)
                      if (latest) setDraft((cur) => draftFromEntry(latest, baseUrl.value, cur))
                    }}
                  />
                ))
            )}
          </SidebarGroup>

          {history.length > 0 && (
            <SidebarGroup
              title="History"
              action={
                <button type="button" onClick={() => setHistory([])} className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300">
                  Clear
                </button>
              }
            >
              {history
                .filter((h) => match(h.draft.method, h.draft.endpoint))
                .map((h) => (
                  <SidebarItem
                    key={h.id}
                    method={h.draft.method}
                    label={h.draft.endpoint}
                    meta={<span className={h.failed || (h.status ?? 0) >= 400 ? 'text-rose-400' : 'text-emerald-500'}>{h.failed ? 'ERR' : h.status}</span>}
                    onClick={() => setDraft(h.draft)}
                  />
                ))}
            </SidebarGroup>
          )}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        {/* Request */}
        <div className="flex max-h-[60%] min-h-0 flex-col border-b border-white/[0.07] lg:max-h-none lg:w-1/2 lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-1.5 text-[11px]">
              <IconButton label={showSidebar ? 'Hide endpoints' : 'Show endpoints'} active={showSidebar} onClick={() => setShowSidebar((s) => !s)}>
                <SidebarIcon size={14} />
              </IconButton>
              <GlobeIcon size={12} className="ml-1 shrink-0 text-zinc-500" />
              <input
                value={baseUrl.value}
                onChange={(e) => baseUrl.set(e.target.value)}
                spellCheck={false}
                placeholder="https://api.example.com"
                className="h-6 min-w-0 flex-1 rounded bg-transparent px-1 font-mono text-[11px] text-zinc-400 outline-none hover:bg-white/[0.03] focus:bg-white/[0.04] focus:text-zinc-100"
                title="Base URL — edit to override"
              />
              <span
                className={cx(
                  'shrink-0 rounded px-1.5 py-px text-[10px] font-medium',
                  baseUrl.source === 'custom' ? 'bg-amber-400/10 text-amber-300' : 'bg-white/5 text-zinc-400',
                )}
              >
                {baseUrl.source === 'env' ? 'from env' : baseUrl.source === 'prop' ? 'from props' : baseUrl.source === 'custom' ? 'custom' : 'current origin'}
              </span>
              {baseUrl.source === 'custom' && (
                <IconButton label="Reset base URL" onClick={baseUrl.reset} className="size-6">
                  <ResetIcon size={12} />
                </IconButton>
              )}
            </div>

            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg bg-white/[0.04] ring-1 ring-white/10 ring-inset focus-within:ring-emerald-400/60">
                <select
                  value={draft.method}
                  onChange={(e) => update({ method: e.target.value as HttpMethod })}
                  className={cx(
                    'h-full cursor-pointer appearance-none rounded-l-lg border-r border-white/10 bg-transparent pr-2 pl-3 font-mono text-[12px] font-bold outline-none',
                    methodText(draft.method),
                  )}
                  aria-label="HTTP method"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m} className="bg-zinc-900 text-zinc-100">
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.endpoint}
                  onChange={(e) => update({ endpoint: e.target.value })}
                  placeholder="/users/1"
                  spellCheck={false}
                  autoComplete="off"
                  className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[12.5px] text-zinc-50 outline-none placeholder:text-zinc-600"
                  aria-label="Endpoint"
                />
              </div>
              <IconButton label="Save endpoint" onClick={save} disabled={!draft.endpoint.trim()} className="size-9">
                <BookmarkIcon size={15} />
              </IconButton>
              {sending ? (
                <Button variant="outline" className="h-9 px-3.5" onClick={() => abortRef.current?.abort()}>
                  <span className="size-3 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-100" />
                  Cancel
                </Button>
              ) : (
                <Button type="submit" variant="primary" className="h-9 px-3.5" disabled={!draft.endpoint.trim()}>
                  <SendIcon size={13} /> Send
                </Button>
              )}
            </form>
            <p className="truncate font-mono text-[10.5px] text-zinc-600" title={request.url}>
              {request.url}
            </p>
          </div>

          <Tabs className="border-y border-white/[0.07] px-2 py-1.5" value={tab} onChange={setTab} tabs={reqTabs} />

          <div className="ws-scroll min-h-0 flex-1 overflow-auto p-3">
            {tab === 'params' && (
              <KeyValueEditor rows={draft.params} onChange={(params) => update({ params })} addLabel="Add param" />
            )}
            {tab === 'headers' && (
              <KeyValueEditor
                rows={draft.headers}
                onChange={(headers) => update({ headers })}
                keyPlaceholder="Header"
                addLabel="Add header"
              />
            )}
            {tab === 'body' &&
              (hasBody(draft.method) ? (
                <div className="flex h-full min-h-36 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Tabs
                      value={draft.bodyType}
                      onChange={(bodyType) => update({ bodyType })}
                      tabs={[
                        { id: 'json', label: 'JSON' },
                        { id: 'text', label: 'Text' },
                      ]}
                    />
                    {draft.bodyType === 'json' && (
                      <Button
                        className="ml-auto"
                        disabled={bodyInvalid || !draft.body.trim()}
                        onClick={() => update({ body: JSON.stringify(JSON.parse(draft.body), null, 2) })}
                      >
                        Format
                      </Button>
                    )}
                  </div>
                  <textarea
                    value={draft.body}
                    onChange={(e) => update({ body: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
                    }}
                    spellCheck={false}
                    placeholder={draft.bodyType === 'json' ? '{\n  "name": "Ada"\n}' : 'Plain text body'}
                    className={cx(
                      'ws-scroll min-h-32 flex-1 resize-none rounded-lg bg-black/30 p-3 font-mono text-[12px] leading-[1.55] text-zinc-100 ring-1 outline-none ring-inset placeholder:text-zinc-700',
                      bodyInvalid ? 'ring-rose-500/50' : 'ring-white/[0.07] focus:ring-emerald-400/50',
                    )}
                  />
                  <p className={cx('text-[10.5px]', bodyInvalid ? 'text-rose-400' : 'text-zinc-600')}>
                    {bodyInvalid ? 'Invalid JSON — it will be sent as-is.' : '⌘/Ctrl + Enter to send'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">{draft.method} requests don't carry a body. Switch the method to send one.</p>
              ))}
            {tab === 'auth' && (
              <div className="flex flex-col gap-2">
                <SectionTitle>Bearer token</SectionTitle>
                <input
                  type="password"
                  value={draft.bearer}
                  onChange={(e) => update({ bearer: e.target.value })}
                  placeholder="Paste a token"
                  className="h-8 rounded-md bg-white/[0.04] px-2.5 font-mono text-[12px] text-zinc-100 ring-1 ring-white/[0.07] outline-none ring-inset placeholder:text-zinc-600 focus:ring-emerald-400/50"
                />
                <p className="text-[11px] text-zinc-500">
                  Sent as <code className="font-mono text-zinc-400">Authorization: Bearer …</code>. Stored in this browser's localStorage only.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Response */}
        <div className="flex min-h-0 flex-1 flex-col">
          {sending ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-zinc-400">
              <span className="size-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" /> Sending request…
            </div>
          ) : !response ? (
            <EmptyState
              icon={<CompassIcon size={18} />}
              title="Send a request to see the response"
              hint={
                <>
                  Type an endpoint like <code className="font-mono text-zinc-400">/users</code> and hit Enter. It's sent to the base URL above.
                </>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/[0.07] px-3 py-2.5 text-[11px] text-zinc-500">
                <MethodBadge method={response.method} />
                <StatusPill status={response.status} statusText={response.statusText} failed={response.state === 'failed'} />
                <span>{formatDuration(response.duration)}</span>
                <span>{formatBytes(response.size)}</span>
                <span className="ml-auto font-mono text-[10.5px] text-zinc-600">{formatTime(response.startedAt)}</span>
              </div>
              <Tabs
                className="border-b border-white/[0.07] px-2 py-1.5"
                value={responseTab}
                onChange={setResponseTab}
                tabs={[
                  { id: 'body', label: 'Body' },
                  { id: 'headers', label: <>Headers <Count n={Object.keys(response.responseHeaders ?? {}).length} /></> },
                ]}
              />
              <div className="ws-scroll min-h-0 flex-1 overflow-auto p-3">
                {response.state === 'failed' ? (
                  <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-rose-500/20">
                    <p className="font-medium">Request failed</p>
                    <p className="mt-1 font-mono text-rose-300/80">{response.error}</p>
                    <p className="mt-2 text-rose-200/60">Check the base URL, that the server is running, and that it allows CORS from this origin.</p>
                  </div>
                ) : responseTab === 'body' ? (
                  <BodyView body={response.responseBody} empty="Empty response body" />
                ) : (
                  <KeyValueTable data={response.responseHeaders} empty="No response headers" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
