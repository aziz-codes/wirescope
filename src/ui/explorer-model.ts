import { joinUrl, tryParseJson, uid } from '../core/utils'
import type { HttpMethod, NetworkEntry, WireScopeEndpoint } from '../types'

export const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export interface KV {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type BodyType = 'json' | 'text'

export interface ExplorerDraft {
  method: HttpMethod
  endpoint: string
  params: KV[]
  headers: KV[]
  bodyType: BodyType
  body: string
  bearer: string
}

export interface HistoryItem {
  id: string
  at: number
  status?: number
  failed?: boolean
  duration?: number
  draft: ExplorerDraft
}

export interface SavedItem {
  id: string
  name: string
  draft: ExplorerDraft
}

export const kv = (key = '', value = '', enabled = true): KV => ({ id: uid(), key, value, enabled })

export const emptyDraft = (defaultHeaders: Record<string, string> = {}): ExplorerDraft => ({
  method: 'GET',
  endpoint: '',
  params: [],
  headers: Object.entries(defaultHeaders).map(([k, v]) => kv(k, v)),
  bodyType: 'json',
  body: '',
  bearer: '',
})

const toRows = (record?: Record<string, string>) => Object.entries(record ?? {}).map(([k, v]) => kv(k, v))

const bodyText = (body: unknown) => (body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body, null, 2))

export function draftFromEndpoint(endpoint: WireScopeEndpoint, base: ExplorerDraft): ExplorerDraft {
  return {
    ...base,
    method: endpoint.method ?? 'GET',
    endpoint: endpoint.path,
    params: [],
    headers: endpoint.headers ? [...base.headers, ...toRows(endpoint.headers)] : base.headers,
    body: bodyText(endpoint.body),
    bodyType: typeof endpoint.body === 'string' && !tryParseJson(endpoint.body).ok ? 'text' : 'json',
  }
}

/** Turns a captured request into an editable draft, relative to the base URL when it matches. */
export function draftFromEntry(entry: NetworkEntry, baseUrl: string, base: ExplorerDraft): ExplorerDraft {
  let endpoint = entry.url
  let params: KV[] = []
  try {
    const u = new URL(entry.url)
    params = [...u.searchParams].map(([k, v]) => kv(k, v))
    const withoutQuery = `${u.origin}${u.pathname}`
    const normalizedBase = baseUrl.replace(/\/+$/, '')
    endpoint = normalizedBase && withoutQuery.startsWith(normalizedBase) ? withoutQuery.slice(normalizedBase.length) || '/' : withoutQuery
  } catch {
    /* keep the raw URL */
  }
  const headers = Object.entries(entry.requestHeaders)
  const auth = headers.find(([k]) => k.toLowerCase() === 'authorization')
  const bearer = auth && /^bearer\s+/i.test(auth[1]) ? auth[1].replace(/^bearer\s+/i, '') : ''
  const method = (entry.method.toUpperCase() as HttpMethod) ?? 'GET'
  return {
    ...base,
    method: METHODS.includes(method) ? method : 'GET',
    endpoint,
    params,
    headers: headers.filter(([k]) => !(bearer && k.toLowerCase() === 'authorization')).map(([k, v]) => kv(k, v)),
    body: entry.requestBody && !entry.requestBody.startsWith('[') ? entry.requestBody : '',
    bodyType: tryParseJson(entry.requestBody).ok || !entry.requestBody ? 'json' : 'text',
    bearer: bearer || base.bearer,
  }
}

export const hasBody = (method: string) => !['GET', 'HEAD'].includes(method)

export function buildRequest(draft: ExplorerDraft, baseUrl: string) {
  let url = joinUrl(baseUrl, draft.endpoint)
  const params = draft.params.filter((p) => p.enabled && p.key)
  if (params.length) {
    try {
      const u = new URL(url)
      for (const p of params) u.searchParams.append(p.key, p.value)
      url = u.href
    } catch {
      url += (url.includes('?') ? '&' : '?') + params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    }
  }

  const headers: Record<string, string> = {}
  for (const h of draft.headers) if (h.enabled && h.key) headers[h.key] = h.value
  if (draft.bearer.trim()) headers.Authorization = `Bearer ${draft.bearer.trim()}`

  const sendBody = hasBody(draft.method) && draft.body.trim() !== ''
  if (sendBody && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = draft.bodyType === 'json' ? 'application/json' : 'text/plain'
  }
  return { method: draft.method, url, headers, body: sendBody ? draft.body : undefined }
}

/** Groups concrete paths like /users/42 under /users/:id for the Discovered list. */
export function templatePath(pathname: string) {
  return pathname
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seg) || /^[0-9a-f]{24}$/i.test(seg) ? ':id' : seg))
    .join('/')
}
