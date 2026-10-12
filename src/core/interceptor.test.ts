import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installWireScope, sendExplorerRequest, setIgnoreRules, store, uninstallWireScope } from './interceptor'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('fetch interception', () => {
  beforeEach(() => {
    store.clear()
    store.setPaused(false)
    setIgnoreRules([])
    window.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? new Response('{"error":"nope"}', { status: 404, headers: { 'content-type': 'application/json' } })
        : new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as typeof fetch
    installWireScope()
  })
  afterEach(() => uninstallWireScope())

  it('records a successful request with its response body', async () => {
    const res = await fetch('/api/users', { method: 'POST', body: '{"name":"a"}', headers: { 'x-test': '1' } })
    expect(await res.json()).toEqual({ ok: true })
    await flush()
    const [entry] = store.getSnapshot().entries
    expect(entry).toMatchObject({
      source: 'fetch',
      method: 'POST',
      state: 'success',
      status: 200,
      requestBody: '{"name":"a"}',
      requestHeaders: { 'x-test': '1' },
      responseBody: '{"ok":true}',
      size: 11,
    })
    expect(entry.url).toMatch(/\/api\/users$/)
  })

  it('marks 4xx responses as errors', async () => {
    await fetch('/api/x', { method: 'DELETE' })
    await flush()
    expect(store.getSnapshot().entries[0]).toMatchObject({ state: 'error', status: 404 })
  })

  it('marks network failures as failed and rethrows', async () => {
    uninstallWireScope()
    window.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    installWireScope()
    await expect(fetch('/down')).rejects.toThrow('Failed to fetch')
    expect(store.getSnapshot().entries[0]).toMatchObject({ state: 'failed' })
  })

  it('skips ignored URLs and paused traffic', async () => {
    setIgnoreRules([/health/])
    await fetch('/health')
    store.setPaused(true)
    await fetch('/api/users')
    expect(store.getSnapshot().entries).toHaveLength(0)
  })

  it('records explorer requests once, even while paused', async () => {
    store.setPaused(true)
    const entry = await sendExplorerRequest({ method: 'GET', url: '/api/users', headers: {} })
    expect(entry).toMatchObject({ source: 'explorer', status: 200, responseBody: '{"ok":true}' })
    expect(store.getSnapshot().entries).toHaveLength(1)
  })
})
