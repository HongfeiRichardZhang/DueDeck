import { Loader2, CheckCircle2 } from 'lucide-react'
import InfoTip from './InfoTip'

// ── Score Gauge (semicircle SVG) ─────────────────────────────────────────────
function ScoreGauge({ score }) {
  const pct = (score ?? 0) / 100
  const cx = 90, cy = 86, r = 70
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const angle = pct * Math.PI
  const ex = cx - r * Math.cos(angle)
  const ey = cy - r * Math.sin(angle)
  const scorePath = score != null && score > 0
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`
    : null
  const color = !score ? '#e5e7eb'
    : score >= 75 ? '#8b5cf6'
    : score >= 60 ? '#f59e0b'
    : '#ef4444'
  return (
    <svg width="100%" viewBox="0 0 180 92" style={{ maxWidth: 200 }}>
      <path d={track} stroke="#f3f4f6" strokeWidth="13" fill="none" strokeLinecap="round" />
      {scorePath && (
        <path d={scorePath} stroke={color} strokeWidth="13" fill="none" strokeLinecap="round"
          style={{ transition: 'all 0.8s ease' }} />
      )}
    </svg>
  )
}

// ── Analytics Pipeline config ────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: 'ingestion',    label: 'Document Ingestion' },
  { key: 'gap_detector', label: 'Data Extraction'    },
  { key: 'agents',       label: 'Multi-Agent Eval'   },
  { key: 'synthesis',    label: 'Memo Synthesis'     },
  { key: 'debate',       label: 'Debate Phase'       },
  { key: 'ic',           label: 'IC Decision'        },
]
const STEP_ORDER = ['ingestion', 'gap_detector', 'agents', 'synthesis', 'debate', 'ic', 'done']

// ── Panel shell ──────────────────────────────────────────────────────────────
function Panel({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function Row1Cards({ profile, gaps, synthesis, overallScore, status, pipelineStep }) {
  const isAnalyzing = status === 'analyzing'
  const currentIdx = STEP_ORDER.indexOf(pipelineStep ?? '')

  return (
    <div className="grid grid-cols-3 gap-3">

      {/* Card 1 — Company */}
      <Panel className="p-4 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <span className="text-violet-700 font-bold text-base">
              {profile?.company_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 truncate">
                {profile?.company_name ?? 'Awaiting upload'}
              </span>
              {profile?.stage && (
                <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  {profile.stage}
                </span>
              )}
            </div>
            {profile?.market && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {profile.market.split(' ').slice(0, 4).join(' ')}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
          {profile?.description ?? 'Upload a pitch deck or business plan to extract company information.'}
        </p>
        {profile && (
          <div className="flex gap-3 mt-auto pt-1 border-t border-gray-50">
            {profile.founded  && <div><p className="text-[10px] text-gray-400">Founded</p><p className="text-xs font-semibold text-gray-700">{profile.founded}</p></div>}
            {profile.stage    && <div><p className="text-[10px] text-gray-400">Stage</p><p className="text-xs font-semibold text-gray-700">{profile.stage}</p></div>}
            {profile.location && <div><p className="text-[10px] text-gray-400">HQ</p><p className="text-xs font-semibold text-gray-700">{profile.location}</p></div>}
          </div>
        )}
      </Panel>

      {/* Card 2 — Score Gauge */}
      <Panel className="p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-800">Overall Diligence Score</span>
          <InfoTip text="Weighted average of all 8 agent scores based on your custom weights. Adjust weights in the panel below to reflect your investment strategy." />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-full flex justify-center">
            <ScoreGauge score={overallScore} />
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
              {overallScore != null ? (
                <>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-bold text-gray-900">{overallScore}</span>
                    <span className="text-sm text-gray-400">/100</span>
                  </div>
                  <span className="text-xs text-gray-400 mt-0.5">
                    {overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Fair' : 'Needs work'}
                  </span>
                </>
              ) : isAnalyzing ? (
                <Loader2 size={20} className="animate-spin text-blue-400" />
              ) : (
                <span className="text-2xl font-bold text-gray-200">—</span>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Card 3 — Analytics Pipeline */}
      <Panel className="p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-800">Analytics Pipeline</span>
            <InfoTip text="Real-time status of the 6-stage AI analysis pipeline." />
          </div>
          {isAnalyzing ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] text-blue-500 font-medium">Live</span>
            </div>
          ) : pipelineStep === 'done' ? (
            <span className="text-[10px] text-emerald-600 font-medium">Complete</span>
          ) : null}
        </div>

        {/* 2 × 3 grid of steps */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 flex-1 content-center">
          {PIPELINE_STEPS.map((step, i) => {
            const done   = currentIdx > i || pipelineStep === 'done'
            const active = pipelineStep === step.key

            return (
              <div key={step.key} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-colors ${
                active ? 'bg-blue-50' : done ? 'bg-gray-50' : 'bg-gray-50/40'
              }`}>
                {/* Icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-emerald-500' : active ? 'bg-blue-600' : 'bg-gray-200'
                }`}>
                  {done
                    ? <CheckCircle2 size={12} className="text-white" />
                    : active
                      ? <Loader2 size={12} className="text-white animate-spin" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  }
                </div>

                {/* Label + status */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-medium leading-none truncate ${
                    done ? 'text-gray-700' : active ? 'text-blue-700' : 'text-gray-300'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-[9px] mt-0.5 leading-none ${
                    done ? 'text-emerald-500' : active ? 'text-blue-400' : 'text-gray-300'
                  }`}>
                    {done ? 'Done' : active ? 'Running…' : 'Pending'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

    </div>
  )
}
