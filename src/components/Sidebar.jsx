import { useRef, useState, useEffect } from 'react'
import {
  Eye, EyeOff, Plus, Trash2,
  CheckCircle2, FileText, FileSpreadsheet, Presentation, File, Sparkles, Loader2,
  Send, Bot,
} from 'lucide-react'
import InfoTip from './InfoTip'

const FILE_ICONS = {
  pdf:  { icon: FileText,        bg: 'bg-red-50',    color: 'text-red-500'   },
  xlsx: { icon: FileSpreadsheet, bg: 'bg-green-50',  color: 'text-green-600' },
  xls:  { icon: FileSpreadsheet, bg: 'bg-green-50',  color: 'text-green-600' },
  pptx: { icon: Presentation,   bg: 'bg-orange-50', color: 'text-orange-500' },
  ppt:  { icon: Presentation,   bg: 'bg-orange-50', color: 'text-orange-500' },
  docx: { icon: File,           bg: 'bg-blue-50',   color: 'text-blue-500'  },
  doc:  { icon: File,           bg: 'bg-blue-50',   color: 'text-blue-500'  },
}
const DEFAULT_ICON = { icon: File, bg: 'bg-gray-100', color: 'text-gray-400' }

function fmtSize(bytes) {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.round(bytes / 1000)} KB`
}

// ── File row with delete ──────────────────────────────────────────────────────
function FileRow({ src, onRemove }) {
  const fi = FILE_ICONS[src.type] || DEFAULT_ICON
  const Icon = fi.icon
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 group">
      <div className={`w-9 h-9 rounded-lg ${fi.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={fi.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{src.name}</p>
        <p className="text-xs text-gray-400">{fmtSize(src.size)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {src.status === 'uploading' ? (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Loader2 size={11} className="animate-spin" /> Parsing…
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 size={12} /> Parsed
          </span>
        )}
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 p-0.5 rounded transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function ChatPanel({ files, sessionId, apiKey }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const hasFiles = files.some(f => f.status === 'parsed')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    if (!input.trim() || loading || !hasFiles) return
    const userMsg = { id: Date.now(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          api_key: apiKey,
          message: userMsg.content,
          history: messages,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.response }])
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  if (!hasFiles) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-8 text-gray-400">
        <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
          <Bot size={20} className="text-gray-300" />
        </div>
        <p className="text-xs leading-relaxed">Upload sources first to chat<br />with your project materials.</p>
      </div>
    )
  }

  return (
    <>
      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-gray-400">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
              <Bot size={20} className="text-violet-400" />
            </div>
            <p className="text-xs leading-relaxed">Ask questions about<br />your uploaded materials.</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input fixed at bottom */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about your materials…"
            className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 resize-none leading-relaxed"
            style={{ maxHeight: 80, overflowY: 'auto' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </>
  )
}

// ── Data panel ────────────────────────────────────────────────────────────────
function DataField({ label, value }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      {Array.isArray(value) ? (
        <ul className="space-y-0.5">
          {value.map((v, i) => (
            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
              <span>{typeof v === 'object' ? JSON.stringify(v) : v}</span>
            </li>
          ))}
        </ul>
      ) : typeof value === 'object' ? (
        <div className="space-y-0.5">
          {Object.entries(value).filter(([, v]) => v != null).map(([k, v]) => (
            <p key={k} className="text-xs text-gray-700"><span className="text-gray-400">{k}:</span> {v}</p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-700 leading-relaxed">{value}</p>
      )}
    </div>
  )
}

function DataSection({ title, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 border-b border-gray-100 pb-1">{title}</p>
      {children}
    </div>
  )
}

function TeamMember({ member }) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg bg-gray-50">
      <p className="text-xs font-semibold text-gray-800">{member.name}</p>
      <p className="text-[10px] text-violet-600 font-medium">{member.role}</p>
      {member.background && <p className="text-[10px] text-gray-500 leading-relaxed">{member.background}</p>}
    </div>
  )
}

function DataPanel({ profile }) {
  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-8 text-gray-400">
        <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <p className="text-xs leading-relaxed">Extracted data will appear here<br />after analysis runs.</p>
      </div>
    )
  }

  const { company_name, founded, location, stage, funding_ask, valuation,
    description, market, tam, business_model, revenue_model,
    team, traction, arr_mrr, growth_rate, runway, use_of_funds,
    competitors, differentiation, financials, risks } = profile

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 min-h-0">
      <DataSection title="Company">
        <DataField label="Name" value={company_name} />
        <DataField label="Description" value={description} />
        <div className="grid grid-cols-2 gap-2">
          <DataField label="Stage" value={stage} />
          <DataField label="Founded" value={founded} />
          <DataField label="Location" value={location} />
          <DataField label="Funding Ask" value={funding_ask} />
          {valuation && <DataField label="Valuation" value={valuation} />}
          {runway && <DataField label="Runway" value={runway} />}
        </div>
        {use_of_funds && <DataField label="Use of Funds" value={use_of_funds} />}
      </DataSection>

      <DataSection title="Market">
        <DataField label="Target Market" value={market} />
        <DataField label="TAM" value={tam} />
        <DataField label="Business Model" value={business_model} />
        <DataField label="Revenue Model" value={revenue_model} />
      </DataSection>

      {Array.isArray(team) && team.length > 0 && (
        <DataSection title="Team">
          <div className="flex flex-col gap-1.5">
            {team.map((m, i) => <TeamMember key={i} member={m} />)}
          </div>
        </DataSection>
      )}

      <DataSection title="Traction">
        <div className="grid grid-cols-2 gap-2">
          {arr_mrr && <DataField label="ARR / MRR" value={arr_mrr} />}
          {growth_rate && <DataField label="Growth Rate" value={growth_rate} />}
        </div>
        <DataField label="Traction Summary" value={traction} />
      </DataSection>

      {competitors?.length > 0 && (
        <DataSection title="Competition">
          <DataField label="Key Competitors" value={competitors} />
          <DataField label="Differentiation" value={differentiation} />
        </DataSection>
      )}

      {financials && Object.values(financials).some(v => v != null) && (
        <DataSection title="Financials">
          <DataField label="Financial Data" value={financials} />
        </DataSection>
      )}

      {risks?.length > 0 && (
        <DataSection title="Risks">
          <DataField label="Identified Risks" value={risks} />
        </DataSection>
      )}
    </div>
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────────
export default function Sidebar({
  apiKey, onApiKeyChange, keyConfirmed, onConfirmKey,
  files, onFilesSelected, onFileRemove, onStartAnalysis, status,
  sessionId, profile,
}) {
  const [showKey, setShowKey] = useState(false)
  const [mode, setMode] = useState('sources')
  const fileRef = useRef(null)

  const canAnalyze = keyConfirmed && files.length > 0 && files.some(f => f.status === 'parsed') && status !== 'analyzing'
  const isAnalyzing = status === 'analyzing'

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-gray-100 flex items-center justify-center">
        {/* Segmented control — full width, equal tabs */}
        <div className="flex w-full bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {[{ key: 'sources', label: 'Sources' }, { key: 'data', label: 'Data' }, { key: 'chat', label: 'Chat' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all duration-150 text-center ${
                mode === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {mode === 'sources' ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
            {/* API Key */}
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-xs font-medium text-gray-600">Model API Key</span>
                <InfoTip text="Your key is sent directly to OpenAI or Anthropic — it never touches our servers." />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative min-w-0">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => onApiKeyChange(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="sk-… or sk-ant-…"
                  />
                  <button onClick={() => setShowKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={onConfirmKey}
                  disabled={!apiKey.startsWith('sk-')}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
                >
                  Confirm
                </button>
              </div>
              {keyConfirmed && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Key confirmed · stored locally
                </p>
              )}
            </div>

            {/* Add sources */}
            <input ref={fileRef} type="file" multiple accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.csv" className="hidden"
              onChange={e => { if (e.target.files?.length) { onFilesSelected(e.target.files); e.target.value = '' } }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium rounded-xl py-2.5 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-40 transition-colors"
            >
              <Plus size={16} /> Add sources
            </button>


            {/* File list */}
            {files.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    Uploaded sources <span className="font-semibold text-gray-700">{files.length}</span>
                  </span>
                  <span className="text-xs text-gray-400">Newest</span>
                </div>
                <div className="flex flex-col gap-1">
                  {files.map((src, i) => (
                    <FileRow key={i} src={src} onRemove={() => onFileRemove(src.name)} />
                  ))}
                </div>
              </div>
            )}

            {files.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-gray-400">
                <FileText size={32} className="mb-2 opacity-30" />
                <p className="text-xs">Upload a pitch deck, business plan,<br />or any supporting documents</p>
              </div>
            )}
          </div>

          {/* Start Analysis */}
          <div className="p-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onStartAnalysis}
              disabled={!canAnalyze}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-blue-200"
            >
              {isAnalyzing ? (
                <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
              ) : (
                <>Start Analysis <Sparkles size={16} /></>
              )}
            </button>
            {!keyConfirmed && <p className="text-xs text-center text-gray-400 mt-2">Enter & confirm your API key to start</p>}
          </div>
        </>
      ) : mode === 'data' ? (
        <DataPanel profile={profile} />
      ) : (
        <ChatPanel files={files} sessionId={sessionId} apiKey={apiKey} />
      )}
    </aside>
  )
}
