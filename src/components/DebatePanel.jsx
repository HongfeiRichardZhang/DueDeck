import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ThumbsUp, ThumbsDown } from 'lucide-react'

// ── Simple inline markdown renderer ──────────────────────────────────────────
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**')
          ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
          : p
      )}
    </>
  )
}

function MarkdownText({ content }) {
  const lines = content.split('\n')
  const els = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('**') && line.endsWith('**')) {
      els.push(<p key={i} className="text-xs font-semibold text-gray-700 mt-2 mb-0.5">{line.slice(2, -2)}</p>)
    } else if (line.trim() === '') {
      els.push(<div key={i} className="h-1" />)
    } else {
      els.push(<p key={i} className="text-xs text-gray-600 leading-relaxed"><Inline text={line} /></p>)
    }
    i++
  }
  return <div>{els}</div>
}

// ── Expand modal ──────────────────────────────────────────────────────────────
function ExpandModal({ title, text, accentColor, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-[600px] max-h-[75vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <span className={`text-sm font-semibold ${accentColor}`}>{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <MarkdownText content={text} />
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Agent card ────────────────────────────────────────────────────────────────
function AgentCard({ side, text, done, isStreaming, isActive }) {
  const isSupport = side === 'support'
  const scrollRef = useRef(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text, isStreaming])

  const borderColor = isSupport ? 'border-emerald-200' : 'border-red-200'
  const headerBg    = isSupport ? 'bg-emerald-50'      : 'bg-red-50'
  const headerText  = isSupport ? 'text-emerald-700'   : 'text-red-700'
  const badgeBg     = isSupport ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
  const accentColor = isSupport ? 'text-emerald-700'   : 'text-red-700'
  const IconComp    = isSupport ? ThumbsUp : ThumbsDown
  const iconColor   = isSupport ? 'text-emerald-600'   : 'text-red-600'
  const idleIconBg  = isSupport ? 'bg-emerald-50'      : 'bg-red-50'
  const title       = isSupport ? 'Support Agent'      : 'Opposition Agent'
  const subtitle    = isSupport ? 'Pro-Investment Case': 'Anti-Investment Case'

  const notStarted = !isActive && !text && !done

  return (
    <div className={`flex-1 min-w-0 bg-white rounded-2xl border ${borderColor} shadow-sm flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`${headerBg} px-4 py-2.5 flex items-center gap-2 flex-shrink-0 border-b ${borderColor}`}>
        <IconComp size={15} className={iconColor} strokeWidth={2.5} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${headerText}`}>{title}</p>
          <p className="text-[10px] text-gray-500">{subtitle}</p>
        </div>
        {isStreaming && (
          <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeBg}`}>
            Streaming
          </span>
        )}
        {done && (
          <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Done
          </span>
        )}
        {notStarted && (
          <span className="text-[9px] font-medium text-gray-400 px-2 py-0.5 rounded-full border border-gray-200">
            Awaiting
          </span>
        )}
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight: 220, maxHeight: 280 }}>
        {notStarted ? (
          /* ── Idle: big thumb icon centered ────────────────────────── */
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ minHeight: 200 }}>
            <div className={`w-20 h-20 rounded-3xl ${idleIconBg} flex items-center justify-center shadow-sm`}>
              <IconComp size={40} className={iconColor} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-400">
                {isSupport ? 'Pro-Investment Case' : 'Anti-Investment Case'}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Starts once analysis runs
              </p>
            </div>
          </div>
        ) : text ? (
          /* ── Streaming / done text ────────────────────────────────── */
          <div className="relative">
            <MarkdownText content={text} />
            {isStreaming && (
              <span className="inline-block w-0.5 h-3 bg-gray-400 ml-0.5 animate-pulse" />
            )}
          </div>
        ) : (
          /* ── Active but waiting for first chunk ───────────────────── */
          <div className="flex flex-col gap-2 pt-1">
            <div className="h-2.5 bg-gray-200 rounded w-4/5 animate-pulse" />
            <div className="h-2.5 bg-gray-200 rounded w-3/5 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="h-2.5 bg-gray-200 rounded w-full  animate-pulse" style={{ animationDelay: '300ms' }} />
            <div className="h-2.5 bg-gray-200 rounded w-2/3  animate-pulse" style={{ animationDelay: '450ms' }} />
          </div>
        )}
      </div>

      {/* Footer */}
      {done && text && (
        <div className={`px-4 py-2 border-t ${borderColor} flex-shrink-0`}>
          <button
            onClick={() => setShowModal(true)}
            className={`text-[11px] font-medium ${accentColor} hover:underline`}
          >
            Read full argument →
          </button>
        </div>
      )}

      {showModal && (
        <ExpandModal
          title={`${title} — Full Argument`}
          text={text}
          accentColor={accentColor}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ── VS connector ──────────────────────────────────────────────────────────────
function VsConnector({ active }) {
  return (
    <div className="flex flex-col items-center justify-center flex-shrink-0 w-10 gap-1">
      <div className={`flex-1 w-px ${active ? 'bg-gradient-to-b from-emerald-200 to-gray-100' : 'bg-gray-100'}`} />
      <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
        active ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-150'
      }`}>
        <span className={`text-[9px] font-black tracking-tighter ${active ? 'text-gray-400' : 'text-gray-300'}`}>VS</span>
      </div>
      <div className={`flex-1 w-px ${active ? 'bg-gradient-to-b from-gray-100 to-red-200' : 'bg-gray-100'}`} />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DebatePanel({ supportText, oppositionText, supportDone, oppositionDone, pipelineStep }) {
  const DEBATE_STEPS = ['debate', 'ic', 'done']
  const isActive        = DEBATE_STEPS.includes(pipelineStep) || supportText.length > 0 || oppositionText.length > 0
  const supportStreaming    = !supportDone   && supportText.length > 0
  const oppositionStreaming = !oppositionDone && oppositionText.length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex gap-0 items-stretch" style={{ minHeight: 260 }}>
        <AgentCard
          side="support"
          text={supportText}
          done={supportDone}
          isStreaming={supportStreaming}
          isActive={isActive}
        />
        <VsConnector active={isActive} />
        <AgentCard
          side="opposition"
          text={oppositionText}
          done={oppositionDone}
          isStreaming={oppositionStreaming}
          isActive={isActive}
        />
      </div>
    </div>
  )
}
