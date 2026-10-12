import type { IgnoreRule, NetworkEntry, RequestSource } from '../types'
import { createStore, type NetworkStore } from './store'
import { byteLength, describeBody, headersToObject, parseRawHeaders, resolveUrl, uid } from './utils'

/** Bodies larger than this are truncated in the inspector (the app still gets the full body). */
const MAX_BODY_CHARS = 1_000_000

interface XhrMeta {
  method: string
  url: string
  headers: Record<string, string>
}

interface WireScopeGlobal {
  store: NetworkStore
  installed: boolean
  ignore: IgnoreRule[]
  originalFetch?: typeof fetch
  originalXhr?: {
    open: XMLHttpRequest['open']
    send: XMLHttpRequest['send']
    setRequestHeader: XMLHttpRequest['setRequestHeader']
  }
}

// Kept on globalThis so HMR re-evaluating this module doesn't double-patch
// fetch or orphan the store that the patched functions write to.
const g = globalThis as typeof globalThis & { __WIRESCOPE__?: WireScopeGlobal }
const state: WireScopeGlobal = (g.__WIRESCOPE__ ??= { store: createStore(), installed: false, ignore: [] })

export const store = state.store

const xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>()

function isIgnored(url: string): boolean {
  return state.ignore.some((rule) =>
    typeof rule === 'string' ? url.includes(rule) : rule instanceof RegExp ? rule.test(url) : rule(url),
  )
}

export function setIgnoreRules(rules: IgnoreRule[]) {
  state.ignore = rules
}

const clip = (text: string) =>
  text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}\n… [truncated by wirescope]` : text

function start(source: RequestSource, method: string, url: string, headers: Record<string, string>, body?: string) {
  const entry: NetworkEntry = {
    id: uid(),
    source,
    method: method.toUpperCase(),
    url,
    requestHeaders: headers,
    requestBody: body,
    state: 'pending',
    startedAt: Date.now(),
  }
  store.add(entry)
  return { id: entry.id, t0: performance.now(), entry }
}

const isStreaming = (contentType: string | null) => !!contentType && /event-stream|octet-stream|^video|^audio/.test(contentType)

async function recordFetchResponse(id: string, t0: number, response: Response) {
  const contentType = response.headers.get('content-type')
  store.update(id, {
    state: response.ok ? 'success' : 'error',
    status: response.status,
    statusText: response.statusText,
    responseHeaders: headersToObject(response.headers),
    duration: performance.now() - t0,
  })
  if (!response.body || isStreaming(contentType)) {
    const length = response.headers.get('content-length')
    if (length) store.update(id, { size: Number(length) })
    return
  }
  try {
    const text = await response.clone().text()
    store.update(id, { responseBody: clip(text), size: byteLength(text) })
  } catch {
    /* body unreadable (aborted mid-stream) — headers are still recorded */
  }
}

function patchFetch() {
  const original = window.fetch
  state.originalFetch = original
  window.fetch = async function wirescopeFetch(input: RequestInfo | URL, init?: RequestInit) {
    const isRequest = typeof Request !== 'undefined' && input instanceof Request
    const url = resolveUrl(isRequest ? input.url : input instanceof URL ? input.href : String(input))
    if (isIgnored(url)) return original.call(window, input, init)

    const method = init?.method ?? (isRequest ? input.method : 'GET')
    const headers = headersToObject(init?.headers ?? (isRequest ? input.headers : undefined))
    const { id, t0 } = start('fetch', method, url, headers, describeBody(init?.body))
    if (isRequest && init?.body === undefined && input.body) {
      input
        .clone()
        .text()
        .then((text) => store.update(id, { requestBody: text }))
        .catch(() => {})
    }

    try {
      const response = await original.call(window, input, init)
      void recordFetchResponse(id, t0, response)
      return response
    } catch (error) {
      store.update(id, { state: 'failed', error: errorMessage(error), duration: performance.now() - t0 })
      throw error
    }
  }
}

function xhrResponseText(xhr: XMLHttpRequest): string | undefined {
  switch (xhr.responseType) {
    case '':
    case 'text':
      return xhr.responseText
    case 'json':
      return xhr.response == null ? undefined : JSON.stringify(xhr.response)
    case 'document':
      return xhr.responseXML?.documentElement?.outerHTML
    case 'blob':
      return xhr.response ? `[Blob ${xhr.response.size} B]` : undefined
    case 'arraybuffer':
      return xhr.response ? `[Binary ${xhr.response.byteLength} B]` : undefined
  }
}

function patchXhr() {
  const proto = XMLHttpRequest.prototype
  const { open, send, setRequestHeader } = proto
  state.originalXhr = { open, send, setRequestHeader }

  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    xhrMeta.set(this, { method, url: resolveUrl(String(url)), headers: {} })
    return (open as (...args: unknown[]) => void).call(this, method, url, ...rest)
  } as XMLHttpRequest['open']

  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const meta = xhrMeta.get(this)
    if (meta) meta.headers[name] = value
    return setRequestHeader.call(this, name, value)
  }

  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = xhrMeta.get(this)
    if (meta && !isIgnored(meta.url)) {
      const { id, t0 } = start('xhr', meta.method, meta.url, meta.headers, describeBody(body))
      this.addEventListener('loadend', () => {
        const duration = performance.now() - t0
        if (this.status === 0) {
          store.update(id, { state: 'failed', error: 'Network error or request aborted', duration })
          return
        }
        let text: string | undefined
        try {
          text = xhrResponseText(this)
        } catch {
          text = undefined
        }
        store.update(id, {
          state: this.status >= 400 ? 'error' : 'success',
          status: this.status,
          statusText: this.statusText,
          responseHeaders: parseRawHeaders(this.getAllResponseHeaders()),
          responseBody: text == null ? undefined : clip(text),
          size: text == null ? undefined : byteLength(text),
          duration,
        })
      })
    }
    return send.call(this, body)
  }
}

/** Starts capturing fetch and XMLHttpRequest traffic. Idempotent; no-op on the server. */
export function installWireScope(options: { ignore?: IgnoreRule[]; maxRequests?: number } = {}) {
  if (options.ignore) setIgnoreRules(options.ignore)
  if (options.maxRequests) store.setLimit(options.maxRequests)
  if (state.installed || typeof window === 'undefined') return
  state.installed = true
  if (typeof window.fetch === 'function') patchFetch()
  if (typeof XMLHttpRequest !== 'undefined') patchXhr()
}

/** Restores the original fetch and XMLHttpRequest. */
export function uninstallWireScope() {
  if (!state.installed) return
  if (state.originalFetch) window.fetch = state.originalFetch
  if (state.originalXhr) Object.assign(XMLHttpRequest.prototype, state.originalXhr)
  state.installed = false
}

export interface ExplorerRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
}

/**
 * Sends a request on behalf of the Explorer. It bypasses the patch (so it is
 * recorded once, tagged `explorer`) and resolves with the settled entry.
 */
export async function sendExplorerRequest(req: ExplorerRequest): Promise<NetworkEntry> {
  const doFetch = state.originalFetch ?? window.fetch
  const url = resolveUrl(req.url)
  const hasBody = req.body != null && req.body !== '' && !['GET', 'HEAD'].includes(req.method)
  const { id, t0, entry } = start('explorer', req.method, url, req.headers, hasBody ? req.body : undefined)
  let patch: Partial<NetworkEntry>
  try {
    const response = await doFetch.call(window, url, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? req.body : undefined,
      signal: req.signal,
    })
    const text = await response.text()
    patch = {
      state: response.ok ? 'success' : 'error',
      status: response.status,
      statusText: response.statusText,
      responseHeaders: headersToObject(response.headers),
      responseBody: clip(text),
      size: byteLength(text),
      duration: performance.now() - t0,
    }
  } catch (error) {
    patch = { state: 'failed', error: errorMessage(error), duration: performance.now() - t0 }
  }
  store.update(id, patch)
  // Built locally: the store entry may already be gone if the list was cleared.
  return { ...entry, ...patch }
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Request aborted'
  if (error instanceof TypeError) return `${error.message} (network error, CORS, or offline)`
  return error instanceof Error ? error.message : String(error)
}
