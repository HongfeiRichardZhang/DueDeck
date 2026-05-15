import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function show() {
    if (!ref.current) return
    setRect(ref.current.getBoundingClientRect())
    setOpen(true)
  }

  const above = rect ? rect.top > 160 : true
  const tipWidth = 224 // w-56

  let tipLeft = rect ? rect.left + rect.width / 2 : 0
  // clamp so tooltip doesn't go off screen edges
  tipLeft = Math.max(tipWidth / 2 + 8, Math.min(tipLeft, window.innerWidth - tipWidth / 2 - 8))

  return (
    <span ref={ref} className="relative inline-flex items-center flex-shrink-0">
      <span
        className="text-gray-400 text-xs cursor-help select-none leading-none"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : show())}
      >
        ⓘ
      </span>

      {open && rect && createPortal(
        <span
          className="fixed z-[9999] w-56 bg-gray-800 text-white text-[11px] leading-relaxed rounded-xl px-3 py-2 shadow-xl pointer-events-none text-center"
          style={{
            left: tipLeft,
            transform: 'translateX(-50%)',
            ...(above
              ? { bottom: window.innerHeight - rect.top + 8 }
              : { top: rect.bottom + 8 }),
          }}
        >
          {text}
          {/* arrow */}
          <span
            className="absolute left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={above
              ? { top: '100%', borderTopColor: '#1f2937' }
              : { bottom: '100%', borderBottomColor: '#1f2937' }}
          />
        </span>,
        document.body,
      )}
    </span>
  )
}
