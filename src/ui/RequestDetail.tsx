import { useMemo, useState } from 'react'
import { formatBytes, formatDuration, formatTime, splitUrl, toCurl } from '../core/utils'
import type { NetworkEntry } from '../types'
import { BodyView } from './BodyView'
import { CloseIcon, ExternalIcon, ReplayIcon } from './icons'
import { Button, CopyButton, IconButton, KeyValueTable, MethodBadge, SectionTitle, StatusPill, Tabs } from './primitives'

type DetailTab = 'response' | 'headers' | 'payload'

export function RequestDetail({
  entry,
  onClose,
  onReplay,
  onOpenInExplorer,
}: {
  entry: NetworkEntry
  onClose: () => void
  onReplay: (entry: NetworkEntry) => void
  onOpenInExplorer: (entry: NetworkEntry) => void
}) {
  const [tab, setTab] = useState<DetailTab>('response')
  const { path } = splitUrl(entry.url)
  const query = useMemo(() => {
    try {
      return Object.fromEntries(new URL(entry.url).searchParams)
    } catch {
      return {}
    }
  }, [entry.url])

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div className="flex flex-col gap-2 border-b border-white/[0.07] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <MethodBadge method={entry.method} />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-100" title={entry.url}>
            {path}
          </span>
          <IconButton label="Close details" onClick={onClose}>
            <CloseIcon size={14} />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-zinc-500">
          <StatusPill status={entry.status} statusText={entry.statusText} failed={entry.state === 'failed'} />
          <span>{formatDuration(entry.duration)}</span>
          <span>{formatBytes(entry.size)}</span>
          <span className="ml-auto flex items-center gap-0.5">
            <Button onClick={() => onReplay(entry)} title="Send this request again">
              <ReplayIcon size={13} /> Replay
            </Button>
            <Button onClick={() => onOpenInExplorer(entry)} title="Edit and resend in the Explorer">
              <ExternalIcon size={13} /> Explorer
            </Button>
            <CopyButton text={toCurl(entry)} label="cURL" />
          </span>
        </div>
      </div>

      <Tabs
        className="border-b border-white/[0.07] px-2 py-1.5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'response', label: 'Response' },
          { id: 'headers', label: 'Headers' },
          { id: 'payload', label: 'Payload' },
        ]}
      />

      <div className="ws-scroll min-h-0 flex-1 overflow-auto p-3">
        {tab === 'response' &&
          (entry.state === 'failed' ? (
            <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-rose-500/20">
              <p className="font-medium">Request failed</p>
              <p className="mt-1 font-mono text-rose-300/80">{entry.error}</p>
            </div>
          ) : entry.state === 'pending' ? (
            <p className="px-1 text-xs text-zinc-500 italic">Waiting for response…</p>
          ) : (
            <BodyView body={entry.responseBody} empty="Empty response body" />
          ))}

        {tab === 'headers' && (
          <div className="flex flex-col gap-4">
            <section>
              <SectionTitle>General</SectionTitle>
              <KeyValueTable
                data={{
                  'Request URL': entry.url,
                  'Request Method': entry.method,
                  'Status Code': entry.status != null ? `${entry.status} ${entry.statusText ?? ''}`.trim() : entry.state,
                  Source: entry.source,
                  Started: formatTime(entry.startedAt),
                  Duration: formatDuration(entry.duration),
                }}
              />
            </section>
            <section>
              <SectionTitle>Response Headers</SectionTitle>
              <KeyValueTable data={entry.responseHeaders} empty="No response headers (yet)" />
            </section>
            <section>
              <SectionTitle>Request Headers</SectionTitle>
              <KeyValueTable data={entry.requestHeaders} empty="No custom request headers" />
            </section>
          </div>
        )}

        {tab === 'payload' && (
          <div className="flex flex-col gap-4">
            <section>
              <SectionTitle>Query Parameters</SectionTitle>
              <KeyValueTable data={query} empty="No query parameters" />
            </section>
            <section>
              <SectionTitle>Request Body</SectionTitle>
              <BodyView body={entry.requestBody} empty="No request body" />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
