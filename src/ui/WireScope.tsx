import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { isProduction, readEnvBaseUrl } from '../core/env'
import { installWireScope, sendExplorerRequest, store } from '../core/interceptor'
import { usePersistentState } from '../core/storage'
import type { NetworkEntry, WireScopeProps } from '../types'
import { draftFromEntry, emptyDraft, type ExplorerDraft } from './explorer-model'
import { ExplorerTab, type BaseUrlState } from './ExplorerTab'
import { CloseIcon, CompassIcon, LogoIcon, MaximizeIcon, MinimizeIcon, NetworkIcon } from './icons'
import { NetworkTab } from './NetworkTab'
import { cx, IconButton, Tabs } from './primitives'
import { ShadowHost } from './ShadowHost'

// Dev-server noise that nobody wants in the list.
const DEFAULT_IGNORE = [/\/__vite_ping/, /hot-update\.json/, /\/_next\/webpack-hmr/, /__nextjs_original-stack-frame/]

const BUTTON_POSITION = {
  'bottom-right': 'bottom-5 right-5',
  'bottom-left': 'bottom-5 left-5',
  'top-right': 'top-5 right-5',
  'top-left': 'top-5 left-5',
} as const

const MIN_HEIGHT = 220

type Tab = 'network' | 'explorer'

/**
 * Floating network inspector + API explorer. Render it once near your app root.
 * It is a no-op in production builds unless `enabled` is set.
 */
export function WireScope({ enabled, ...props }: WireScopeProps) {
  if (!(enabled ?? !isProduction()) || typeof window === 'undefined') return null
  return <WireScopeDevtools {...props} />
}

function WireScopeDevtools({
  baseUrl: baseUrlProp,
  endpoints = [],
  defaultHeaders,
  position = 'bottom-right',
  initialOpen = false,
  defaultTab = 'network',
  ignore = [],
  maxRequests = 300,
  hotkey = 'W',
}: Omit<WireScopeProps, 'enabled'>) {
  // Installed during render (not in an effect) so requests fired from other
  // components' first effects are captured too. Idempotent.
  installWireScope({ ignore: [...DEFAULT_IGNORE, ...ignore], maxRequests })

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [open, setOpen] = usePersistentState('open', initialOpen)
  const [tab, setTab] = usePersistentState<Tab>('tab', defaultTab)
  const [fullscreen, setFullscreen] = usePersistentState('fullscreen', false)
  const [height, setHeight] = usePersistentState('height', 420)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = usePersistentState<ExplorerDraft>('draft', emptyDraft(defaultHeaders))
  const [baseOverride, setBaseOverride] = usePersistentState<string | null>('baseUrl', null)

  const baseUrl = useMemo<BaseUrlState>(() => {
    const env = baseUrlProp ? undefined : readEnvBaseUrl()
    const fallback = baseUrlProp ?? env ?? window.location.origin
    return {
      value: baseOverride ?? fallback,
      source: baseOverride != null ? 'custom' : baseUrlProp ? 'prop' : env ? 'env' : 'origin',
      set: (value) => setBaseOverride(value === fallback ? null : value),
      reset: () => setBaseOverride(null),
    }
  }, [baseUrlProp, baseOverride, setBaseOverride])

  // Alt+Shift+<hotkey> toggles the panel. Uses `code` so it works with any layout/OS.
  useEffect(() => {
    if (!hotkey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === `Key${hotkey.toUpperCase()}`) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey, setOpen])

  const startResize = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault()
      const onMove = (ev: PointerEvent) =>
        setHeight(Math.round(Math.min(window.innerHeight - 40, Math.max(MIN_HEIGHT, window.innerHeight - ev.clientY))))
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.userSelect = ''
      }
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setHeight],
  )

  const replay = useCallback(async (entry: NetworkEntry) => {
    const result = await sendExplorerRequest({
      method: entry.method,
      url: entry.url,
      headers: entry.requestHeaders,
      body: entry.requestBody,
    })
    setSelectedId(result.id)
  }, [])

  const openInExplorer = useCallback(
    (entry: NetworkEntry) => {
      setDraft((d) => draftFromEntry(entry, baseUrl.value, d))
      setTab('explorer')
    },
    [baseUrl.value, setDraft, setTab],
  )

  const { entries } = snapshot
  const errorCount = entries.filter((e) => e.state === 'error' || e.state === 'failed').length
  const pendingCount = entries.filter((e) => e.state === 'pending').length

  return (
    <ShadowHost>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Open wirescope${hotkey ? ` (Alt+Shift+${hotkey.toUpperCase()})` : ''}`}
          aria-label="Open wirescope network inspector"
          className={cx(
            'group fixed z-[2147483647] flex size-12 animate-pop cursor-pointer items-center justify-center rounded-full bg-zinc-950 text-emerald-300 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-transform duration-200 hover:scale-105 hover:ring-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none active:scale-95',
            BUTTON_POSITION[position],
          )}
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(52,211,153,0.28),transparent_60%)]" />
          {pendingCount > 0 && <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-emerald-400/40" />}
          <LogoIcon size={24} className="relative transition-transform duration-300 group-hover:rotate-[-8deg]" />
          {errorCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-zinc-950">
              {errorCount > 99 ? '99+' : errorCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="wirescope"
          onKeyDown={(e) => {
            if (e.key === 'Escape') fullscreen ? setFullscreen(false) : setOpen(false)
          }}
          style={fullscreen ? undefined : { height: Math.min(height, window.innerHeight - 40) }}
          className={cx(
            'fixed z-[2147483647] flex animate-slide-up flex-col overflow-hidden bg-zinc-950 text-zinc-200 shadow-[0_-24px_80px_-24px_rgba(0,0,0,0.7)]',
            fullscreen ? 'inset-0' : 'inset-x-0 bottom-0 border-t border-white/10',
          )}
        >
          {!fullscreen && (
            <div
              onPointerDown={startResize}
              className="group absolute inset-x-0 -top-1 z-20 flex h-3 cursor-ns-resize justify-center"
              title="Drag to resize"
            >
              <span className="mt-1.5 h-1 w-12 rounded-full bg-white/10 transition-colors group-hover:bg-emerald-400/70" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

          <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.07] px-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 text-zinc-950 shadow-[0_0_16px_rgba(52,211,153,0.35)]">
                <LogoIcon size={15} strokeWidth={2.4} />
              </span>
              <span className="hidden text-[13px] font-semibold tracking-tight text-zinc-50 sm:inline">wirescope</span>
            </div>
            <span className="h-5 w-px bg-white/10" />
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                {
                  id: 'network',
                  label: (
                    <>
                      <NetworkIcon size={13} /> Network
                      {entries.length > 0 && (
                        <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-300 tabular-nums">{entries.length}</span>
                      )}
                    </>
                  ),
                },
                { id: 'explorer', label: <><CompassIcon size={13} /> Explorer</> },
              ]}
            />
            <div className="ml-auto flex items-center gap-0.5">
              {snapshot.paused && <span className="mr-2 rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">Paused</span>}
              <IconButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setFullscreen(!fullscreen)}>
                {fullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
              </IconButton>
              <IconButton label="Close (Esc)" onClick={() => setOpen(false)}>
                <CloseIcon size={15} />
              </IconButton>
            </div>
          </header>

          <div className="relative min-h-0 flex-1">
            {/* Both tabs stay mounted so switching keeps filters, drafts and responses. */}
            <div className={cx('absolute inset-0', tab !== 'network' && 'hidden')}>
              <NetworkTab
                snapshot={snapshot}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReplay={replay}
                onOpenInExplorer={openInExplorer}
              />
            </div>
            <div className={cx('absolute inset-0', tab !== 'explorer' && 'hidden')}>
              <ExplorerTab draft={draft} setDraft={setDraft} baseUrl={baseUrl} endpoints={endpoints} entries={entries} />
            </div>
          </div>
        </section>
      )}
    </ShadowHost>
  )
}
