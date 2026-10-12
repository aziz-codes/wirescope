import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import css from '../styles.css?inline'

const PROPERTY_RULE = /@property\s+[^{]+\{[^}]*\}/g

/**
 * `@property` rules are ignored inside shadow roots, but Tailwind relies on
 * their initial values (shadows, rings, transforms). Registering them on the
 * document applies them everywhere, including our shadow tree.
 */
function registerProperties() {
  if (document.getElementById('wirescope-properties')) return
  const rules = css.match(PROPERTY_RULE)
  if (!rules) return
  const style = document.createElement('style')
  style.id = 'wirescope-properties'
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

/** Renders children into an isolated shadow root appended to <body>. */
export function ShadowHost({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<ShadowRoot | null>(null)

  useLayoutEffect(() => {
    registerProperties()
    const host = document.createElement('div')
    host.setAttribute('data-wirescope', '')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = css.replace(PROPERTY_RULE, '')
    shadow.appendChild(style)
    setRoot(shadow)
    return () => host.remove()
  }, [])

  return root ? createPortal(<div className="ws-root">{children}</div>, root) : null
}
