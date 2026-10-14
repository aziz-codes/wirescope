# wirescope

[![npm](https://img.shields.io/npm/v/wirescope)](https://www.npmjs.com/package/wirescope)

**An in-app network inspector and API explorer for React.** A small round button sits in the corner of your app; click it and a devtools panel slides up (think React Query Devtools, but for every request your app makes).

- **Network**: every `fetch` and `XMLHttpRequest` (so axios too), live, with status, timing, size, headers, payload and a pretty JSON viewer. Filter, pause, clear, replay, or copy as cURL.
- **Explorer**: type an endpoint, hit Enter, see the response. The base URL comes from your env. Params, headers, JSON body and bearer auth are all supported. The sidebar lists your predefined endpoints, saved requests, endpoints discovered from live traffic, and history.
- **Stays out of the way**: rendered in a Shadow DOM, so its Tailwind styles never touch your app and yours never touch it. Resizable, full-screen mode, `Alt+Shift+W` to toggle.
- **Zero config, zero runtime deps.** No CSS import needed. It's disabled in production builds by default.

![wirescope network inspector](https://raw.githubusercontent.com/aziz-codes/wirescope/main/docs/screenshot.png)

## Install

```bash
npm i -D wirescope
```

## Usage

Render it once, near the root of your app:

```tsx
import { WireScope } from 'wirescope'

export function App() {
  return (
    <>
      <YourApp />
      <WireScope />
    </>
  )
}
```

### Base URL from env

The Explorer sends requests to a base URL. Set it in your `.env`:

| Framework     | Variable                   |
| ------------- | -------------------------- |
| Vite          | `VITE_API_BASE_URL`        |
| Next.js       | `NEXT_PUBLIC_API_BASE_URL` |
| Create React App | `REACT_APP_API_BASE_URL` |

```bash
# .env
VITE_API_BASE_URL=https://api.example.com
```

Bundlers don't always expose env vars to code inside `node_modules`, so the most reliable option is to pass the value explicitly:

```tsx
<WireScope baseUrl={import.meta.env.VITE_API_BASE_URL} />
```

With no base URL set, the Explorer uses the current origin. You can also override it from the panel at any time; the override is remembered in localStorage and can be reset.

### Predefined endpoints

```tsx
<WireScope
  endpoints={[
    { method: 'GET', path: '/users', name: 'List users' },
    { method: 'POST', path: '/auth/login', name: 'Login', body: { email: '', password: '' } },
    { method: 'DELETE', path: '/users/1' },
  ]}
/>
```

### Next.js (App Router)

The bundle ships with `'use client'`, so you can render it straight from `app/layout.tsx`:

```tsx
import { WireScope } from 'wirescope'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <WireScope baseUrl={process.env.NEXT_PUBLIC_API_BASE_URL} />
      </body>
    </html>
  )
}
```

## Props

| Prop             | Type                                                       | Default                      |
| ---------------- | ---------------------------------------------------------- | ---------------------------- |
| `baseUrl`        | `string`                                                   | env, then current origin     |
| `endpoints`      | `WireScopeEndpoint[]`                                      | `[]`                         |
| `defaultHeaders` | `Record<string, string>`                                   | `{}`                         |
| `position`       | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'`         |
| `initialOpen`    | `boolean`                                                  | `false`                      |
| `defaultTab`     | `'network' \| 'explorer'`                                  | `'network'`                  |
| `ignore`         | `Array<string \| RegExp \| (url) => boolean>`              | dev-server noise             |
| `maxRequests`    | `number`                                                   | `300`                        |
| `hotkey`         | `string \| false` (used as `Alt+Shift+<key>`)              | `'W'`                        |
| `enabled`        | `boolean`                                                  | `NODE_ENV !== 'production'`  |

### Capturing requests before React mounts

`<WireScope />` starts capturing when it first renders, which is before any `useEffect` in your app runs. To also catch requests fired at module load, install it first thing in your entry file:

```ts
import { installWireScope } from 'wirescope'
installWireScope()
```

## Notes

- **CORS**: browsers only expose CORS-safelisted response headers to JavaScript on cross-origin requests unless the server sends `Access-Control-Expose-Headers`. The Explorer is subject to the same CORS rules as your app.
- **Production**: wirescope renders nothing when `NODE_ENV === 'production'` unless you pass `enabled`. If you do enable it in production, it is visible to every user, so gate it yourself (e.g. behind an admin check).
- Response bodies over 1 MB are truncated in the inspector only; your app always gets the full response.

## Development

```bash
npm install
npm run dev        # playground at http://localhost:5199 (hot-reloads src/)
npm test
npm run build      # dist/ (ESM + CJS + types, CSS inlined)
```

## License

MIT
