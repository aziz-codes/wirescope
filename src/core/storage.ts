import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'wirescope:'

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable (private mode, quota) — state just won't persist */
  }
}

/** useState that persists to localStorage under a `wirescope:` key. */
export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback))
  useEffect(() => writeStored(key, value), [key, value])
  const set = useCallback((next: T | ((prev: T) => T)) => setValue(next), [])
  return [value, set] as const
}
