export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/** Where a captured request came from. */
export type RequestSource = 'fetch' | 'xhr' | 'explorer'

export type RequestState = 'pending' | 'success' | 'error' | 'failed'

export interface NetworkEntry {
  id: string
  source: RequestSource
  method: string
  /** Absolute URL. */
  url: string
  requestHeaders: Record<string, string>
  requestBody?: string
  state: RequestState
  status?: number
  statusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: string
  /** Response size in bytes (from the body when available). */
  size?: number
  /** Epoch ms when the request started. */
  startedAt: number
  /** Duration in ms, set once the request settles. */
  duration?: number
  error?: string
}

/** A predefined endpoint shown in the Explorer sidebar. */
export interface WireScopeEndpoint {
  path: string
  method?: HttpMethod
  name?: string
  description?: string
  body?: unknown
  headers?: Record<string, string>
}

export type IgnoreRule = string | RegExp | ((url: string) => boolean)

export type ButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface WireScopeProps {
  /**
   * Base URL for the Explorer. Defaults to the first of `VITE_API_BASE_URL`,
   * `NEXT_PUBLIC_API_BASE_URL`, `REACT_APP_API_BASE_URL` found in env, then
   * the current origin.
   */
  baseUrl?: string
  /** Endpoints listed in the Explorer sidebar. */
  endpoints?: WireScopeEndpoint[]
  /** Headers added to every Explorer request (editable in the UI). */
  defaultHeaders?: Record<string, string>
  /** Corner for the floating button. Default `bottom-right`. */
  position?: ButtonPosition
  /** Open the panel on first load. Default `false`. */
  initialOpen?: boolean
  defaultTab?: 'network' | 'explorer'
  /** Requests whose URL matches are not captured. */
  ignore?: IgnoreRule[]
  /** Max captured requests kept in memory. Default 300. */
  maxRequests?: number
  /** Toggle hotkey: Alt+Shift+<key>. Set `false` to disable. Default `'W'`. */
  hotkey?: string | false
  /**
   * Render the devtools. Defaults to `true` outside production
   * (`process.env.NODE_ENV !== 'production'`).
   */
  enabled?: boolean
}
