import { useEffect, useState } from 'react'
import { WireScope } from 'wirescope'

const API = import.meta.env.VITE_API_BASE_URL as string

interface Product {
  id: number
  title: string
  price: number
  thumbnail: string
  category: string
}

// Plain XHR on purpose — shows wirescope captures axios-style traffic too.
function xhrGet<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.onload = () => (xhr.status < 400 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`HTTP ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send()
  })
}

const actions: Array<{ label: string; hint: string; run: () => Promise<unknown> }> = [
  { label: 'GET products', hint: 'fetch', run: () => fetch(`${API}/products?limit=6`) },
  { label: 'GET user (XHR)', hint: 'XMLHttpRequest', run: () => xhrGet(`${API}/users/1`) },
  {
    label: 'POST product',
    hint: 'JSON body',
    run: () =>
      fetch(`${API}/products/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Wirescope Mug', price: 12 }),
      }),
  },
  {
    label: 'PATCH product',
    hint: 'update',
    run: () =>
      fetch(`${API}/products/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 9.99 }),
      }),
  },
  { label: 'DELETE product', hint: 'delete', run: () => fetch(`${API}/products/1`, { method: 'DELETE' }) },
  { label: 'Slow request', hint: '2s delay', run: () => fetch(`${API}/products/2?delay=2000`) },
  { label: '404 Not Found', hint: 'error', run: () => fetch(`${API}/http/404`) },
  { label: '500 Server Error', hint: 'error', run: () => fetch(`${API}/http/500/Something%20broke`) },
  { label: 'Network failure', hint: 'unreachable host', run: () => fetch('https://wirescope-does-not-exist.invalid/ping') },
]

export function App() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetch(`${API}/products?limit=8&select=title,price,thumbnail,category`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products))
      .catch(() => {})
    xhrGet(`${API}/carts/1`).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Playground
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">wirescope</h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            An in-app network inspector and API explorer for React. Click the round button in the bottom-right corner (or press{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-xs">Alt+Shift+W</kbd>) to open it, then
            fire some requests below.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Base URL from <code className="font-mono">.env</code>: <code className="font-mono text-stone-800">{API}</code>
          </p>
        </header>

        <section className="mb-12">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">Fire requests</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => void a.run().catch(() => {})}
                className="flex cursor-pointer flex-col items-start rounded-xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:shadow active:scale-[0.98]"
              >
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-xs text-stone-500">{a.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">Products (loaded on mount)</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {products.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <img src={p.thumbnail} alt="" className="aspect-square w-full bg-stone-100 object-cover" loading="lazy" />
                <div className="p-3">
                  <h3 className="truncate text-sm font-medium">{p.title}</h3>
                  <p className="text-xs text-stone-500">
                    {p.category} · ${p.price}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <WireScope
        enabled
        endpoints={[
          { method: 'GET', path: '/products', name: 'List products' },
          { method: 'GET', path: '/products/search?q=phone', name: 'Search products' },
          { method: 'POST', path: '/auth/login', name: 'Login', body: { username: 'emilys', password: 'emilyspass' } },
          { method: 'GET', path: '/auth/me', name: 'Current user (needs token)' },
          { method: 'POST', path: '/products/add', name: 'Add product', body: { title: 'New product', price: 10 } },
          { method: 'DELETE', path: '/products/1', name: 'Delete product' },
        ]}
      />
    </div>
  )
}
