let counter = 0
export const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`

export function resolveUrl(url: string): string {
  try {
    return new URL(url, typeof location !== 'undefined' ? location.href : undefined).href
  } catch {
    return url
  }
}

export function headersToObject(headers?: HeadersInit | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => (out[key] = value))
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = value
  } else {
    Object.assign(out, headers)
  }
  return out
}

export function parseRawHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const i = line.indexOf(':')
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
  }
  return out
}

/** Best-effort readable form of a request body, or undefined when there is none. */
export function describeBody(body: unknown): string | undefined {
  if (body == null) return undefined
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const fields: Record<string, string> = {}
    body.forEach((value, key) => {
      fields[key] = typeof value === 'string' ? value : `[File ${value.name}, ${formatBytes(value.size)}]`
    })
    return JSON.stringify(fields, null, 2)
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `[Blob ${formatBytes(body.size)}]`
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return `[Binary ${formatBytes(body.byteLength)}]`
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return '[Stream]'
  return String(body)
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function formatBytes(bytes?: number): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatDuration(ms?: number): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatTime(epoch: number): string {
  const d = new Date(epoch)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/** Splits a URL into what the request list shows: dim origin + bold path. */
export function splitUrl(url: string): { origin: string; path: string; sameOrigin: boolean } {
  try {
    const u = new URL(url)
    const sameOrigin = typeof location !== 'undefined' && u.origin === location.origin
    return { origin: u.origin, path: `${u.pathname}${u.search}`, sameOrigin }
  } catch {
    return { origin: '', path: url, sameOrigin: true }
  }
}

export function tryParseJson(text?: string): { ok: true; value: unknown } | { ok: false } {
  if (!text) return { ok: false }
  const trimmed = text.trim()
  if (!trimmed || !'{["'.includes(trimmed[0]) && !/^(-?\d|true|false|null)/.test(trimmed)) return { ok: false }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false }
  }
}

export function prettyBody(text?: string): string {
  const parsed = tryParseJson(text)
  return parsed.ok ? JSON.stringify(parsed.value, null, 2) : (text ?? '')
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

export function toCurl(entry: {
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody?: string
}): string {
  const parts = [`curl ${shellQuote(entry.url)}`]
  if (entry.method !== 'GET') parts.push(`-X ${entry.method}`)
  for (const [key, value] of Object.entries(entry.requestHeaders)) parts.push(`-H ${shellQuote(`${key}: ${value}`)}`)
  if (entry.requestBody && !entry.requestBody.startsWith('[')) parts.push(`--data-raw ${shellQuote(entry.requestBody)}`)
  return parts.join(' \\\n  ')
}

export function joinUrl(base: string, endpoint: string): string {
  const e = endpoint.trim()
  if (/^https?:\/\//i.test(e)) return e
  if (!base) return resolveUrl(e)
  return `${base.replace(/\/+$/, '')}/${e.replace(/^\/+/, '')}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
