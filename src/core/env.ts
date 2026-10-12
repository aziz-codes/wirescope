// Declared locally so the package does not depend on @types/node.
declare const process: { env: Record<string, string | undefined> }

/**
 * Reads the API base URL from common env conventions. Each lookup is written
 * out literally so bundlers (Vite, webpack/Next, CRA) can statically replace
 * it; anything they don't replace is guarded and falls through.
 */
export function readEnvBaseUrl(): string | undefined {
  let value: string | undefined
  try {
    // @ts-ignore -- import.meta.env exists under Vite
    value = import.meta.env?.VITE_API_BASE_URL
  } catch {
    /* not a Vite build */
  }
  if (value) return value
  try {
    value = process.env.NEXT_PUBLIC_API_BASE_URL
  } catch {
    /* no process in the browser */
  }
  if (value) return value
  try {
    value = process.env.REACT_APP_API_BASE_URL
  } catch {
    /* no process in the browser */
  }
  return value || undefined
}

export function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}
