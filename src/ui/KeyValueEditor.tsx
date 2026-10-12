import { kv, type KV } from './explorer-model'
import { CloseIcon, PlusIcon } from './icons'
import { Button, cx, IconButton } from './primitives'

const inputClass =
  'h-7 min-w-0 flex-1 rounded-md bg-white/[0.04] px-2 font-mono text-[11.5px] text-zinc-100 ring-1 ring-white/[0.07] outline-none ring-inset placeholder:text-zinc-600 focus:ring-emerald-400/50'

export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  addLabel = 'Add',
}: {
  rows: KV[]
  onChange: (rows: KV[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
}) {
  const update = (id: string, patch: Partial<KV>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.id} className={cx('flex items-center gap-1.5', !row.enabled && 'opacity-50')}>
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(row.id, { enabled: e.target.checked })}
            className="size-3.5 shrink-0 cursor-pointer accent-emerald-400"
            aria-label="Enabled"
          />
          <input className={inputClass} value={row.key} placeholder={keyPlaceholder} onChange={(e) => update(row.id, { key: e.target.value })} />
          <input
            className={inputClass}
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => update(row.id, { value: e.target.value })}
          />
          <IconButton label="Remove" onClick={() => onChange(rows.filter((r) => r.id !== row.id))}>
            <CloseIcon size={13} />
          </IconButton>
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={() => onChange([...rows, kv()])}>
          <PlusIcon size={13} /> {addLabel}
        </Button>
      </div>
    </div>
  )
}
