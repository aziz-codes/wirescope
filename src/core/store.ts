import type { NetworkEntry } from '../types'

export interface StoreSnapshot {
  entries: NetworkEntry[]
  paused: boolean
}

type Listener = () => void

export interface NetworkStore {
  getSnapshot(): StoreSnapshot
  subscribe(listener: Listener): () => void
  add(entry: NetworkEntry): void
  update(id: string, patch: Partial<NetworkEntry>): void
  get(id: string): NetworkEntry | undefined
  clear(): void
  setPaused(paused: boolean): void
  setLimit(limit: number): void
}

export function createStore(limit = 300): NetworkStore {
  let snapshot: StoreSnapshot = { entries: [], paused: false }
  const listeners = new Set<Listener>()

  const set = (next: Partial<StoreSnapshot>) => {
    snapshot = { ...snapshot, ...next }
    listeners.forEach((l) => l())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    add(entry) {
      // Explorer requests are always recorded; app traffic respects pause.
      if (snapshot.paused && entry.source !== 'explorer') return
      const entries = [...snapshot.entries, entry]
      set({ entries: entries.length > limit ? entries.slice(entries.length - limit) : entries })
    },
    update(id, patch) {
      const index = snapshot.entries.findIndex((e) => e.id === id)
      if (index === -1) return
      const entries = snapshot.entries.slice()
      entries[index] = { ...entries[index], ...patch }
      set({ entries })
    },
    get: (id) => snapshot.entries.find((e) => e.id === id),
    clear: () => set({ entries: [] }),
    setPaused: (paused) => set({ paused }),
    setLimit(next) {
      limit = next
    },
  }
}
