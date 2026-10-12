import { memo, useMemo, useState } from 'react'
import { prettyBody, tryParseJson } from '../core/utils'
import { ChevronIcon } from './icons'
import { CopyButton, cx, Tabs } from './primitives'

const INDENT = 14

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-zinc-500">null</span>
  switch (typeof value) {
    case 'string':
      return <span className="break-all text-emerald-300">"{value}"</span>
    case 'number':
      return <span className="text-amber-300">{value}</span>
    case 'boolean':
      return <span className="text-violet-300">{String(value)}</span>
    default:
      return <span className="text-zinc-400">{String(value)}</span>
  }
}

const JsonNode = memo(function JsonNode({
  name,
  value,
  depth,
  last,
}: {
  name?: string
  value: unknown
  depth: number
  last: boolean
}) {
  const isObject = value !== null && typeof value === 'object'
  const entries = useMemo(
    () => (isObject ? (Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as object)) : []),
    [isObject, value],
  )
  // Deep or large branches start collapsed to keep big payloads snappy.
  const [open, setOpen] = useState(depth < 2 && entries.length <= 100)
  const comma = last ? '' : ','
  const key = name != null && (
    <>
      <span className="text-sky-300">"{name}"</span>
      <span className="text-zinc-500">: </span>
    </>
  )

  if (!isObject) {
    return (
      <div style={{ paddingLeft: depth * INDENT }} className="py-px">
        {key}
        <Primitive value={value} />
        <span className="text-zinc-600">{comma}</span>
      </div>
    )
  }

  const [openBrace, closeBrace] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  if (!entries.length) {
    return (
      <div style={{ paddingLeft: depth * INDENT }} className="py-px">
        {key}
        <span className="text-zinc-400">
          {openBrace}
          {closeBrace}
        </span>
        <span className="text-zinc-600">{comma}</span>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{ paddingLeft: depth * INDENT }}
        className="group -ml-3.5 flex cursor-pointer items-start py-px hover:bg-white/[0.03]"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronIcon
          size={11}
          className={cx('mt-[3px] mr-[3px] shrink-0 text-zinc-500 transition-transform group-hover:text-zinc-300', open && 'rotate-90')}
        />
        <span>
          {key}
          <span className="text-zinc-400">{openBrace}</span>
          {!open && (
            <>
              <span className="mx-1 rounded bg-white/5 px-1 text-[10.5px] text-zinc-500">
                {entries.length} {Array.isArray(value) ? (entries.length === 1 ? 'item' : 'items') : entries.length === 1 ? 'key' : 'keys'}
              </span>
              <span className="text-zinc-400">{closeBrace}</span>
              <span className="text-zinc-600">{comma}</span>
            </>
          )}
        </span>
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              name={Array.isArray(value) ? undefined : k}
              value={v}
              depth={depth + 1}
              last={i === entries.length - 1}
            />
          ))}
          <div style={{ paddingLeft: depth * INDENT }} className="py-px">
            <span className="text-zinc-400">{closeBrace}</span>
            <span className="text-zinc-600">{comma}</span>
          </div>
        </>
      )}
    </div>
  )
})

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="pl-3.5 font-mono text-[12px] leading-[1.55]">
      <JsonNode value={value} depth={0} last />
    </div>
  )
}

/** Renders a body as a JSON tree when possible, with a raw-text toggle and copy. */
export function BodyView({ body, empty = 'No body' }: { body?: string; empty?: string }) {
  const parsed = useMemo(() => tryParseJson(body), [body])
  const [mode, setMode] = useState<'pretty' | 'raw'>('pretty')

  if (!body) return <p className="px-1 py-2 text-xs text-zinc-500 italic">{empty}</p>

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Tabs
          value={parsed.ok ? mode : 'raw'}
          onChange={setMode}
          tabs={parsed.ok ? [{ id: 'pretty', label: 'Pretty' }, { id: 'raw', label: 'Raw' }] : [{ id: 'raw', label: 'Text' }]}
        />
        <CopyButton text={parsed.ok ? prettyBody(body) : body} />
      </div>
      <div className="ws-scroll overflow-auto rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        {parsed.ok && mode === 'pretty' ? (
          <JsonTree value={parsed.value} />
        ) : (
          <pre className="font-mono text-[12px] leading-[1.55] break-all whitespace-pre-wrap text-zinc-300">
            {parsed.ok ? prettyBody(body) : body}
          </pre>
        )}
      </div>
    </div>
  )
}
