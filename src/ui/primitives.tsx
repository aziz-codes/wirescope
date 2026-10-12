import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { copyText } from '../core/utils'
import { CheckIcon, CopyIcon } from './icons'

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/20',
  POST: 'text-sky-300 bg-sky-400/10 ring-sky-400/20',
  PUT: 'text-amber-300 bg-amber-400/10 ring-amber-400/20',
  PATCH: 'text-violet-300 bg-violet-400/10 ring-violet-400/20',
  DELETE: 'text-rose-300 bg-rose-400/10 ring-rose-400/20',
}

export const methodText = (method: string) => METHOD_COLORS[method]?.split(' ')[0] ?? 'text-zinc-300'

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-5 min-w-12 items-center justify-center rounded-md px-1.5 font-mono text-[10.5px] font-semibold tracking-wide ring-1 ring-inset',
        METHOD_COLORS[method] ?? 'bg-zinc-400/10 text-zinc-300 ring-zinc-400/20',
        className,
      )}
    >
      {method}
    </span>
  )
}

export function statusTone(status?: number, failed?: boolean) {
  if (failed) return 'text-rose-400'
  if (status == null) return 'text-zinc-500'
  if (status >= 500) return 'text-rose-400'
  if (status >= 400) return 'text-orange-300'
  if (status >= 300) return 'text-sky-300'
  return 'text-emerald-400'
}

export function StatusPill({ status, statusText, failed }: { status?: number; statusText?: string; failed?: boolean }) {
  const tone = failed
    ? 'bg-rose-500/10 text-rose-300 ring-rose-500/25'
    : status == null
      ? 'bg-zinc-500/10 text-zinc-300 ring-zinc-500/25'
      : status >= 400
        ? 'bg-rose-500/10 text-rose-300 ring-rose-500/25'
        : status >= 300
          ? 'bg-sky-500/10 text-sky-300 ring-sky-500/25'
          : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset', tone)}>
      <span className="size-1.5 rounded-full bg-current" />
      {failed ? 'Failed' : status == null ? 'Pending' : `${status}${statusText ? ` ${statusText}` : ''}`}
    </span>
  )
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-white/8 text-zinc-100',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Button({
  variant = 'ghost',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300',
        variant === 'ghost' && 'text-zinc-300 hover:bg-white/8 hover:text-zinc-50',
        variant === 'outline' && 'text-zinc-300 ring-1 ring-white/10 ring-inset hover:bg-white/5 hover:text-zinc-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function CopyButton({ text, label = 'Copy', compact }: { text: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }
  if (compact) {
    return (
      <IconButton label={label} onClick={onClick}>
        {copied ? <CheckIcon size={14} className="text-emerald-400" /> : <CopyIcon size={14} />}
      </IconButton>
    )
  }
  return (
    <Button onClick={onClick}>
      {copied ? <CheckIcon size={13} className="text-emerald-400" /> : <CopyIcon size={13} />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: ReactNode }>
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cx('flex items-center gap-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={cx(
            'relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none',
            tab.id === value ? 'bg-white/8 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
      <h4 className="text-[10.5px] font-semibold tracking-[0.08em] text-zinc-500 uppercase">{children}</h4>
      {action}
    </div>
  )
}

export function KeyValueTable({ data, empty = 'None' }: { data?: Record<string, string>; empty?: string }) {
  const rows = Object.entries(data ?? {})
  if (!rows.length) return <p className="px-1 text-xs text-zinc-500 italic">{empty}</p>
  return (
    <dl className="grid grid-cols-[minmax(110px,max-content)_1fr] gap-x-4 gap-y-1 rounded-lg bg-white/[0.02] p-2.5 font-mono text-[11.5px] ring-1 ring-white/5">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-zinc-500">{key}</dt>
          <dd className="break-all text-zinc-200">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 ring-1 ring-white/10">{icon}</div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {hint && <p className="max-w-xs text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
