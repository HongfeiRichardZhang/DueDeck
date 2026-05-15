import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, RotateCcw, Sparkles, X, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react'
import { DEFAULT_WEIGHTS } from '../constants'
import InfoTip from './InfoTip'

// ── Formula modal ─────────────────────────────────────────────────────────────
function FormulaModal({ onClose, onApply, apiKey }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const taRef = useRef(null)

  useEffect(() => { taRef.current?.focus() }, [])

  async function handleApply() {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/interpret_formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text.trim(), api_key: apiKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
      onApply({ expr: data.formula_expr, display: data.formula_display })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 w-[500px] flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Customize Score Formula</h2>
            <p className="text-xs text-gray-400 mt-0.5">Describe how to combine the 8 agent scores into an overall score.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Examples */}
        <div className="mx-5 mb-3 bg-gray-50 rounded-xl p-3 text-[11px] text-gray-500 leading-relaxed space-y-1">
          <p className="font-medium text-gray-600 mb-1.5">Examples</p>
          <p>"Use geometric mean of team and market as the base, then blend with the rest."</p>
          <p>"Gate the score — if team or market is below 50, cap the total at 60."</p>
          <p className="font-mono text-[10px] text-gray-400">"Score = √(team × market) × 0.4 + (product + traction + business_model) / 3 × 0.4 + (competition + financials + risk) / 3 × 0.2"</p>
        </div>

        {/* Input */}
        <div className="px-5 pb-4">
          <textarea
            ref={taRef}
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleApply() }}
            placeholder="Describe a formula, or write one directly using: team, market, product, traction, business_model, competition, financials, risk…"
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none leading-relaxed text-gray-700"
            rows={4}
          />
          {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">⌘ + Enter to apply</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!text.trim() || loading}
              className="px-4 py-2 text-xs font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {loading ? 'Interpreting…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Agent detail modal ────────────────────────────────────────────────────────
function BulletList({ items, icon: Icon, color, emptyMsg }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-[11px] text-gray-400 italic">{emptyMsg}</p>
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[11px] text-gray-700 leading-relaxed">
          <Icon size={11} className={`mt-0.5 flex-shrink-0 ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ConfidencePill({ confidence }) {
  const map = {
    high:   'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low:    'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${map[confidence] ?? 'bg-gray-100 text-gray-500'}`}>
      {confidence ?? 'n/a'} confidence
    </span>
  )
}

function AgentDetailModal({ agent, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-[560px] max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${agent.color}11 0%, white 100%)` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: `${agent.color}18` }}>
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-gray-900">{agent.label} Analysis</h2>
              {agent.confidence && <ConfidencePill confidence={agent.confidence} />}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">{agent.sub}</p>
          </div>
          <div className="flex items-baseline gap-0.5 flex-shrink-0">
            <span className="text-2xl font-bold" style={{ color: agent.color }}>{agent.score}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Score bar */}
        <div className="px-5 py-2 bg-gray-50 flex-shrink-0">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${agent.score}%`, backgroundColor: agent.color }} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">

          {/* Analysis summary */}
          {agent.analysis && (
            <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Analysis Summary</p>
              <p className="text-xs text-gray-700 leading-relaxed">{agent.analysis}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Strengths */}
            <div className="px-3 py-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <TrendingUp size={10} /> Strengths
              </p>
              <BulletList items={agent.strengths} icon={TrendingUp} color="text-emerald-500"
                emptyMsg="No strengths recorded." />
            </div>

            {/* Weaknesses */}
            <div className="px-3 py-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <TrendingDown size={10} /> Weaknesses
              </p>
              <BulletList items={agent.weaknesses} icon={TrendingDown} color="text-amber-500"
                emptyMsg="No weaknesses recorded." />
            </div>
          </div>

          {/* Risks */}
          {Array.isArray(agent.risks) && agent.risks.length > 0 && (
            <div className="px-3 py-3 rounded-xl bg-red-50/60 border border-red-100">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle size={10} /> Risks
              </p>
              <BulletList items={agent.risks} icon={AlertTriangle} color="text-red-400"
                emptyMsg="No risks recorded." />
            </div>
          )}

          {/* Missing info */}
          {Array.isArray(agent.missing_info) && agent.missing_info.length > 0 && (
            <div className="px-3 py-3 rounded-xl bg-blue-50/60 border border-blue-100">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Info size={10} /> Missing Information
              </p>
              <BulletList items={agent.missing_info} icon={Info} color="text-blue-400"
                emptyMsg="No missing info noted." />
            </div>
          )}

          {/* Extras (any additional fields from LLM) */}
          {agent.extras && typeof agent.extras === 'object' && Object.keys(agent.extras).length > 0 && (
            <div className="px-3 py-3 rounded-xl bg-violet-50/60 border border-violet-100">
              <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-2">Additional Notes</p>
              {Object.entries(agent.extras).map(([k, v]) => (
                <div key={k} className="mb-1.5">
                  <p className="text-[9px] font-semibold text-violet-500 uppercase tracking-wide">{k.replace(/_/g, ' ')}</p>
                  {Array.isArray(v) ? (
                    <BulletList items={v} icon={Info} color="text-violet-400" emptyMsg="" />
                  ) : (
                    <p className="text-[11px] text-gray-700">{String(v)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">Generated by the {agent.label} Analysis Agent</p>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const PRESETS = {
  'Pre-seed': { team: 30, market: 25, product: 20, traction: 10, business_model: 5,  competition: 5, financials: 2, risk: 3 },
  'Angel':    { team: 35, market: 25, product: 20, traction: 10, business_model: 3,  competition: 2, financials: 2, risk: 3 },
  'Seed':     { team: 25, market: 25, product: 20, traction: 15, business_model: 5,  competition: 5, financials: 3, risk: 2 },
  'Pre-A':    { team: 20, market: 20, product: 18, traction: 20, business_model: 10, competition: 5, financials: 5, risk: 2 },
}

function stageToPreset(stage) {
  if (!stage) return null
  const s = stage.toLowerCase().replace(/[_\s]+/g, '-')
  if (s.includes('angel')) return 'Angel'
  if (s.includes('pre-seed') || s.includes('preseed')) return 'Pre-seed'
  if (s.includes('pre-a') || s.includes('prea')) return 'Pre-A'
  if (s.includes('series-a') || s.includes('seriesa')) return 'Pre-A'
  if (s.includes('seed')) return 'Seed'
  return null
}

function parseDollarAmount(str) {
  if (!str) return null
  const m = String(str).match(/([\d,.]+)\s*(k|m|million|thousand)?/i)
  if (!m) return null
  const num = parseFloat(m[1].replace(/,/g, ''))
  const unit = (m[2] || '').toLowerCase()
  return num * (unit.startsWith('m') ? 1_000_000 : (unit === 'k' || unit === 'thousand') ? 1_000 : 1)
}

function inferStageFromProfile(profile) {
  if (!profile) return null
  // 1. Explicit stage field
  const fromStage = stageToPreset(profile.stage)
  if (fromStage) return fromStage
  // 2. Funding ask amount
  const ask = parseDollarAmount(profile.funding_ask)
  if (ask != null) {
    if (ask < 500_000)   return 'Pre-seed'
    if (ask < 3_000_000) return 'Seed'
    if (ask < 8_000_000) return 'Pre-A'
  }
  // 3. ARR/MRR — meaningful revenue → at least Seed
  if (profile.arr_mrr && String(profile.arr_mrr).match(/\d/)) return 'Seed'
  // 4. No team bios + no revenue → Pre-seed
  const hasTeam = Array.isArray(profile.team) && profile.team.length > 0
  const hasRevenue = profile.financials && Object.values(profile.financials).some(v => v != null)
  if (!hasRevenue && !hasTeam) return 'Pre-seed'
  if (!hasRevenue) return 'Pre-seed'
  return null
}

const AGENT_KEYS = ['team','market','product','traction','business_model','competition','financials','risk']
const AGENT_LABELS = { team:'Team', market:'Market', product:'Product', traction:'Traction', business_model:'Business Model', competition:'Competition', financials:'Financials', risk:'Risk' }
const COL1 = ['team','market','product','traction']
const COL2 = ['business_model','competition','financials','risk']

export default function AgentScores({ agentScores, pipelineStep, weights, onWeightsChange, overallScore, profile, apiKey, customFormula, onFormulaChange }) {
  const [localWeights, setLocalWeights] = useState({ ...weights })
  const [activePreset, setActivePreset] = useState(null)
  const [autoDetected, setAutoDetected] = useState(false)
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)

  // After full analysis: infer stage from profile and show the badge
  useEffect(() => {
    const preset = inferStageFromProfile(profile)
    if (!preset) return
    setActivePreset(preset)
    setAutoDetected(true)
    setLocalWeights({ ...PRESETS[preset] })
    onWeightsChange({ ...PRESETS[preset] })
  }, [profile])
  const agentsRunning = pipelineStep === 'agents'
  const total = Object.values(localWeights).reduce((a, b) => a + b, 0)
  const totalOk = total === 100

  function applyPreset(name) {
    setActivePreset(name)
    setAutoDetected(false)
    setLocalWeights({ ...PRESETS[name] })
    onWeightsChange({ ...PRESETS[name] })
  }

  function handleSlider(key, val) {
    setActivePreset(null)
    setLocalWeights(prev => ({ ...prev, [key]: Number(val) }))
  }

  function applyWeights() {
    if (totalOk) onWeightsChange({ ...localWeights })
  }

  function resetDefault() {
    setActivePreset(null)
    setAutoDetected(false)
    setLocalWeights({ ...DEFAULT_WEIGHTS })
    onWeightsChange({ ...DEFAULT_WEIGHTS })
    onFormulaChange(null)
  }

  return (
    <>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Agent score cards */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-800">Multi-Agent Evaluation Scores</span>
            <InfoTip text="Each of the 8 dimensions is independently scored 0–100 by a dedicated AI agent that analyzes the relevant sections of your uploaded documents." />
          </div>
          <span className="text-xs text-gray-400">Scores reflect agent confidence</span>
        </div>

        <div className="grid grid-cols-8 gap-2">
          {agentScores.map(agent => {
            const isRunning = agent.running && agent.score == null
            const isWaiting = agentsRunning && agent.score == null && !isRunning
            const hasDetail = agent.score != null
            return (
              <div key={agent.key}
                onClick={() => hasDetail && setSelectedAgent(agent)}
                className={`relative rounded-xl px-3 py-2.5 flex flex-col gap-1 transition-colors ${
                  isRunning ? 'bg-white' : 'border border-gray-100 hover:border-gray-200'
                } ${hasDetail ? 'cursor-pointer hover:shadow-sm' : ''}`}>
                {/* Animated running border (gradient sweep) */}
                {isRunning && <span className="agent-running-border" aria-hidden />}

                <div className="flex items-center gap-1.5 relative">
                  <span className="text-base leading-none flex-shrink-0">{agent.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-gray-600 leading-none truncate">{agent.label}</p>
                    <p className="text-[9px] text-gray-400 leading-none mt-0.5 truncate">{agent.sub}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-0.5 relative">
                  {agent.score != null ? (
                    <>
                      <span className="text-xl font-bold leading-none" style={{ color: agent.color }}>{agent.score}</span>
                      <span className="text-[10px] text-gray-400">/100</span>
                    </>
                  ) : isRunning || isWaiting ? (
                    <Loader2 size={14} className="animate-spin text-blue-400 mt-1" />
                  ) : (
                    <span className="text-xl font-bold text-gray-200">—</span>
                  )}
                </div>
                {/* Mini bar */}
                <div className="h-1 bg-gray-100 rounded-full relative">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: agent.score != null ? `${agent.score}%` : '0%', backgroundColor: agent.color }} />
                </div>
                {hasDetail && (
                  <p className="text-[8px] text-gray-300 text-center mt-0.5 leading-none">tap for details</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Weight formula + sliders */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-4">

          {/* Left: Formula */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Overall Score Formula</p>
            <p className="text-[10px] text-gray-400 mb-2">Overall Diligence Score is a weighted average of each agent score.</p>
            <div className={`rounded-xl px-3 py-2 mb-2 ${customFormula ? 'bg-violet-50 border border-violet-200' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-gray-500">Formula</p>
                  {customFormula && (
                    <span className="text-[9px] font-medium bg-violet-600 text-white px-1.5 py-0.5 rounded-full">Custom</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {customFormula && (
                    <button
                      onClick={() => onFormulaChange(null)}
                      className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => setShowFormulaModal(true)}
                    className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors"
                  >
                    <Sparkles size={10} /> Customize
                  </button>
                </div>
              </div>
              <p className="text-xs font-mono text-gray-700 italic leading-relaxed break-words">
                {customFormula ? customFormula.display : 'Score = Σ (Agent Score × Weight)'}
              </p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-violet-600">{overallScore ?? '—'}</span>
              <span className="text-sm text-gray-400">/ 100</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">Current Overall Diligence Score</p>
            <p className="text-[10px] text-gray-400 mt-1">Adjust weights to reflect your investment strategy.</p>
          </div>

          {/* Right: Preset profiles + sliders */}
          <div>
            {/* Preset tabs */}
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-[10px] text-gray-500 mr-1 whitespace-nowrap">Preset Profiles</span>
              {Object.keys(PRESETS).map(name => (
                <button key={name} onClick={() => applyPreset(name)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                    activePreset === name
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                  }`}>
                  {name}
                </button>
              ))}
            </div>
            {/* Sliders */}
            <div className={`grid grid-cols-2 gap-x-6 gap-y-1.5 ${customFormula ? 'opacity-30 pointer-events-none select-none' : ''}`}>
              {[COL1, COL2].map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1.5">
                  {col.map(key => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 w-20 flex-shrink-0">{AGENT_LABELS[key]}</span>
                      <input type="range" min={0} max={50} value={localWeights[key]}
                        onChange={e => handleSlider(key, e.target.value)}
                        className="flex-1 h-1 accent-violet-600 cursor-pointer" />
                      <span className="text-[10px] font-medium text-gray-700 w-6 text-right">{localWeights[key]}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Total + actions */}
            {activePreset && autoDetected && (
              <p className="text-[10px] text-violet-500 mt-2">
                Auto-detected from document: <span className="font-medium">{activePreset}</span>
              </p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              {customFormula ? (
                <span className="text-[10px] text-violet-500 italic">Weights overridden by custom formula</span>
              ) : (
                <span className={`text-[10px] font-medium flex items-center gap-1 ${totalOk ? 'text-emerald-600' : 'text-red-500'}`}>
                  Total Weight: {total}%
                  {totalOk ? ' ✓' : ` (need ${100 - total > 0 ? '+' : ''}${100 - total}% to reach 100%)`}
                </span>
              )}
              <div className="flex items-center gap-2">
                <button onClick={resetDefault}
                  className="text-[10px] text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 flex items-center gap-1">
                  <RotateCcw size={9} /> Reset Default
                </button>
                {!customFormula && (
                  <button onClick={applyWeights} disabled={!totalOk}
                    className="text-[10px] bg-violet-600 text-white rounded-lg px-3 py-1 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                    Apply Weights
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showFormulaModal && (
      <FormulaModal
        apiKey={apiKey}
        onClose={() => setShowFormulaModal(false)}
        onApply={formula => onFormulaChange(formula)}
      />
    )}
    {selectedAgent && (
      <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    )}
    </>
  )
}
