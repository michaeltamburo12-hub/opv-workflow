// Non-blocking notices that fade on their own. Replaces window.alert(), which froze the page
// until someone clicked OK. Callable from anywhere on the client: toast('Saved').

type Kind = 'success' | 'error' | 'info'

const COLORS: Record<Kind, { bg: string; border: string }> = {
  success: { bg: '#0f2a1d', border: '#22c55e' },
  error: { bg: '#2a1215', border: '#ef4444' },
  info: { bg: '#1a1d27', border: '#6366f1' },
}

function guessKind(msg: string): Kind {
  if (/^(error|.*\b(failed|fail|could not|couldn't|required|first\b|enter |no |please |select |paste ))/i.test(msg)) return 'error'
  if (/^[✅✓]|saved|updated|added|copied|created/i.test(msg)) return 'success'
  return 'info'
}

function container(): HTMLElement {
  let el = document.getElementById('toast-root')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast-root'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    Object.assign(el.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '100000',
      display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end',
      pointerEvents: 'none', maxWidth: 'min(420px, calc(100vw - 40px))',
    })
    document.body.appendChild(el)
  }
  return el
}

export function toast(message: unknown, kind?: Kind) {
  if (typeof document === 'undefined') return
  const msg = String(message ?? '').replace(/^[✅✓]\s*/, '')
  const k = kind ?? guessKind(String(message ?? ''))
  const c = COLORS[k]
  const item = document.createElement('div')
  item.textContent = msg
  Object.assign(item.style, {
    background: c.bg, color: '#f3f4f6', border: `1px solid ${c.border}`, borderLeftWidth: '4px',
    borderRadius: '8px', padding: '10px 14px', fontSize: '14px', lineHeight: '1.4',
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
    boxShadow: '0 6px 20px rgba(0,0,0,.35)', whiteSpace: 'pre-line', pointerEvents: 'auto', cursor: 'pointer',
    opacity: '0', transform: 'translateY(6px)', transition: 'opacity .2s ease, transform .2s ease',
  })
  const dismiss = () => {
    item.style.opacity = '0'
    item.style.transform = 'translateY(6px)'
    setTimeout(() => item.remove(), 220)
  }
  item.addEventListener('click', dismiss)
  container().appendChild(item)
  requestAnimationFrame(() => { item.style.opacity = '1'; item.style.transform = 'translateY(0)' })
  setTimeout(dismiss, k === 'error' ? 6000 : 2800)
}
