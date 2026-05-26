import { Loader2, Gavel, ScrollText, AlertTriangle, MessageCircleQuestion, Clock, CheckCircle2 } from 'lucide-react'

const IC_LEVELS = [
  {
    level: 1, label: 'Invest', icon: '✓',
    summary: 'Has enough upside with acceptable risk. Proceed to the next step of the investment process.',
    grad: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-300', bg: 'bg-emerald-500',
    hoverBg: 'hover:bg-emerald-50', borderActive: 'border-emerald-500', borderIdle: 'border-emerald-200',
    iconBg: 'bg-emerald-100', iconText: 'text-emerald-700', textIdle: 'text-emerald-700',
  },
  {
    level: 2, label: 'Need More Diligence', icon: 'ℹ',
    summary: 'Has potential but critical data is missing. Supplement materials before re-judging.',
    grad: 'from-amber-500 to-amber-600', ring: 'ring-amber-300', bg: 'bg-amber-500',
    hoverBg: 'hover:bg-amber-50', borderActive: 'border-amber-500', borderIdle: 'border-amber-200',
    iconBg: 'bg-amber-100', iconText: 'text-amber-700', textIdle: 'text-amber-700',
  },
  {
    level: 3, label: 'Watchlist', icon: '⌚',
    summary: 'Not investing now, but the direction is attractive. Observe over the next 3–6 months.',
    grad: 'from-blue-500 to-blue-600', ring: 'ring-blue-300', bg: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-50', borderActive: 'border-blue-500', borderIdle: 'border-blue-200',
    iconBg: 'bg-blue-100', iconText: 'text-blue-700', textIdle: 'text-blue-700',
  },
  {
    level: 4, label: 'Pass', icon: '✕',
    summary: 'Risk-reward does not match, or material hard issues exist. Do not proceed.',
    grad: 'from-red-500 to-red-600', ring: 'ring-red-300', bg: 'bg-red-500',
    hoverBg: 'hover:bg-red-50', borderActive: 'border-red-500', borderIdle: 'border-red-200',
    iconBg: 'bg-red-100', iconText: 'text-red-700', textIdle: 'text-red-700',
  },
]

// 3 IC committee members — cartoon avatars via DiceBear notionists-neutral
const IC_MEMBER_META = [
  {
    id: 'managing_partner',
    name: 'Sarah Chen',
    role: 'Managing Partner',
    focus: 'Downside risk & portfolio fit',
    photo: 'https://api.dicebear.com/9.x/notionists-neutral/svg?seed=SarahChen',
    bg: '#dbeafe',
  },
  {
    id: 'general_partner',
    name: 'Marcus Reid',
    role: 'General Partner',
    focus: 'Team quality & market timing',
    photo: 'https://api.dicebear.com/9.x/notionists-neutral/svg?seed=MarcusReid',
    bg: '#ede9fe',
  },
  {
    id: 'principal',
    name: 'Priya Sharma',
    role: 'Principal',
    focus: 'Growth trajectory & innovation',
    photo: 'https://api.dicebear.com/9.x/notionists-neutral/svg?seed=PriyaSharma',
    bg: '#fce7f3',
  },
]

const VOTE_COLORS = {
  'Invest':              { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Need More Diligence': { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  'Watchlist':           { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  'Pass':                { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
}

// ── Sound-wave animation ──────────────────────────────────────────────────────
function SoundWave({ active }) {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0.5, 0.8, 0.4, 1.0, 0.6, 0.9, 0.5, 0.7, 0.3].map((h, i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full ${active ? 'bg-violet-400' : 'bg-gray-300'}`}
          style={{
            height: `${h * 100}%`,
            animation: active ? `wave-bar 1.2s ease-in-out ${i * 0.08}s infinite` : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes wave-bar {
          0%, 100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

// ── IC member card ────────────────────────────────────────────────────────────
function MemberCard({ member, voteData, isDeliberating, notStarted }) {
  const voted = !!voteData
  const vc = voted ? VOTE_COLORS[voteData.vote] : null

  return (
    <div className={`flex-1 rounded-2xl border transition-all overflow-hidden ${
      notStarted    ? 'border-gray-100 bg-gray-50/50 opacity-50' :
      isDeliberating && !voted ? 'border-violet-100 bg-violet-50/30' :
      voted         ? 'border-gray-100 bg-white shadow-sm' :
                      'border-gray-100 bg-white'
    }`}>
      {/* Member identity */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className={`relative flex-shrink-0 ${notStarted ? 'grayscale opacity-40' : ''}`}>
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 flex items-end justify-center ${
            voted ? 'border-emerald-200' : isDeliberating ? 'border-violet-200' : 'border-gray-200'
          }`} style={{ backgroundColor: member.bg }}>
            <img
              src={member.photo}
              alt={member.role}
              className="w-full h-full object-cover"
            />
          </div>
          {voted && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
              <CheckCircle2 size={10} className="text-emerald-500" />
            </span>
          )}
          {isDeliberating && !voted && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-violet-100 flex items-center justify-center">
              <Loader2 size={8} className="animate-spin text-violet-500" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-800 truncate">{member.role}</p>
          <p className="text-[9px] text-gray-400 truncate">{member.focus}</p>
        </div>
      </div>

      {/* Vote result */}
      <div className="px-3 pb-3">
        {notStarted && (
          <div className="h-6 bg-gray-100 rounded-lg" />
        )}
        {isDeliberating && !voted && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-50 border border-violet-100">
            <Loader2 size={9} className="animate-spin text-violet-400 flex-shrink-0" />
            <span className="text-[9px] text-violet-500 font-medium">Deliberating…</span>
          </div>
        )}
        {voted && vc && (
          <div className={`px-2 py-1.5 rounded-lg ${vc.bg} border ${vc.border}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${vc.dot}`} />
              <span className={`text-[10px] font-bold ${vc.text}`}>{voteData.vote}</span>
              <span className={`text-[8px] uppercase tracking-wide ${vc.text} opacity-70 ml-auto`}>
                {voteData.confidence}
              </span>
            </div>
            {voteData.reasoning && (
              <p className="text-[9px] text-gray-600 leading-relaxed line-clamp-2">
                {voteData.reasoning}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ICDecisionPanel({ icSuggestion, icVerdict, onIcVerdict, pipelineStep, icMemberVotes }) {
  const isRunning  = pipelineStep === 'ic'
  const notStarted = !icSuggestion && !isRunning
  const pending    = !icSuggestion && isRunning
  const complete   = !!icSuggestion

  const aiLevel     = icSuggestion?.level ?? null
  const selectedLvl = IC_LEVELS.find(l => l.level === aiLevel)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-5 py-4 bg-gradient-to-r from-violet-50/60 via-white to-blue-50/60 border-b border-gray-100 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0 transition-all ${
          notStarted
            ? 'bg-gray-100'
            : 'bg-gradient-to-br from-violet-500 to-blue-600'
        }`}>
          <Gavel size={20} className={notStarted ? 'text-gray-300' : 'text-white'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`text-sm font-bold ${notStarted ? 'text-gray-400' : 'text-gray-900'}`}>
              Investment Committee
            </h2>
            {notStarted && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                <Clock size={9} /> Awaiting Debate
              </span>
            )}
            {pending && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                <Loader2 size={9} className="animate-spin" />
                In Deliberation
                <SoundWave active />
              </span>
            )}
            {complete && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white bg-gradient-to-r ${selectedLvl?.grad ?? 'from-gray-400 to-gray-500'}`}>
                Final Decision
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-0.5 leading-relaxed ${notStarted ? 'text-gray-400' : 'text-gray-500'}`}>
            {notStarted
              ? 'The IC will convene once the debate phase concludes.'
              : pending
                ? 'Synthesizing debate, weighing trade-offs and preparing a recommendation…'
                : 'The committee has reached a verdict after reviewing all 8 specialist analyses and the support–opposition debate.'}
          </p>
        </div>
      </div>

      {/* ── Committee Members (3 IC agents) ─────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${notStarted ? 'text-gray-300' : 'text-gray-500'}`}>
            Committee Members
          </span>
          <span className={`text-[10px] ${notStarted ? 'text-gray-300' : 'text-gray-400'}`}>
            {notStarted ? 'Not yet convened'
              : pending ? `${Object.keys(icMemberVotes || {}).length} / 3 voted…`
              : '3 / 3 voted'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {IC_MEMBER_META.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              voteData={(icMemberVotes || {})[member.id]}
              isDeliberating={pending}
              notStarted={notStarted}
            />
          ))}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4">

        {/* Final decision banner */}
        <div className="mb-4 rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
            <ScrollText size={11} className="text-gray-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Final Decision</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            {notStarted ? (
              <div className="w-full flex flex-col items-center py-3 gap-1.5">
                <Clock size={20} className="text-gray-200" />
                <span className="text-sm font-medium text-gray-300">Not Yet Convened</span>
                <p className="text-[10px] text-gray-300 text-center">The IC will deliberate after the debate concludes.</p>
              </div>
            ) : pending ? (
              <span className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-blue-600 bg-clip-text text-transparent">
                Pending IC Deliberation
              </span>
            ) : (
              <>
                <div className={`w-9 h-9 rounded-xl ${selectedLvl?.bg ?? 'bg-gray-300'} flex items-center justify-center text-white text-base font-bold flex-shrink-0`}>
                  {selectedLvl?.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-base font-bold ${selectedLvl?.textIdle ?? 'text-gray-700'}`}>{selectedLvl?.label}</p>
                  <p className="text-[11px] text-gray-500 leading-snug">{selectedLvl?.summary}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Loading skeleton — only while actually deliberating */}
        {pending && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-start gap-2.5">
            <Loader2 className="animate-spin text-violet-400 flex-shrink-0 mt-0.5" size={14} />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-2 bg-gray-200 rounded w-1/3 opacity-60" />
              <div className="h-2 bg-gray-200 rounded w-2/3 opacity-40" />
              <div className="h-2 bg-gray-200 rounded w-1/2 opacity-30" />
            </div>
          </div>
        )}

        {/* AI reasoning */}
        {icSuggestion?.reasoning && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-violet-50/60 border border-violet-100">
            <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1.5">IC Reasoning</p>
            <p className="text-xs text-gray-700 leading-relaxed">{icSuggestion.reasoning}</p>
            {Array.isArray(icSuggestion.rationale_points) && icSuggestion.rationale_points.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">Key Rationale</p>
                <ul className="space-y-0.5">
                  {icSuggestion.rationale_points.map((p, i) => (
                    <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                      <span className="mt-0.5 w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Red flags + questions */}
        {(icSuggestion?.red_flags?.length > 0 || icSuggestion?.questions_for_founders?.length > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {icSuggestion?.red_flags?.length > 0 && (
              <div className="px-4 py-3 rounded-xl bg-red-50/60 border border-red-100">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> Red Flags
                </p>
                <ul className="space-y-0.5">
                  {icSuggestion.red_flags.map((p, i) => (
                    <li key={i} className="text-[11px] text-red-700 flex items-start gap-1.5">
                      <span className="mt-0.5 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" /><span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {icSuggestion?.questions_for_founders?.length > 0 && (
              <div className="px-4 py-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <MessageCircleQuestion size={10} /> Ask Founders
                </p>
                <ul className="space-y-0.5">
                  {icSuggestion.questions_for_founders.map((q, i) => (
                    <li key={i} className="text-[11px] text-blue-700 flex items-start gap-1.5">
                      <span className="flex-shrink-0 mt-0.5 text-blue-400 font-semibold">{i + 1}.</span><span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Verdict selector */}
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${notStarted ? 'text-gray-300' : 'text-gray-500'}`}>
            Your Verdict
            {icSuggestion && <span className="ml-1 text-violet-500 normal-case font-medium text-[10px]">(AI suggestion highlighted)</span>}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {IC_LEVELS.map(lvl => {
              const isAiSuggested  = lvl.level === aiLevel && !icVerdict
              const isUserSelected = lvl.level === icVerdict
              const disabled       = notStarted || pending

              let cls = `relative flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 transition-all duration-200 select-none`
              if (disabled)            cls += ` bg-gray-50 border-gray-100 opacity-30 cursor-default`
              else if (isUserSelected) cls += ` ${lvl.bg} ${lvl.borderActive} shadow-md cursor-pointer`
              else if (isAiSuggested)  cls += ` bg-white ${lvl.borderActive} ring-2 ${lvl.ring} ring-offset-1 ${lvl.hoverBg} cursor-pointer`
              else                     cls += ` bg-white ${lvl.borderIdle} ${lvl.hoverBg} opacity-70 hover:opacity-100 cursor-pointer`

              return (
                <button key={lvl.level} disabled={disabled}
                  onClick={() => !disabled && onIcVerdict(isUserSelected ? null : lvl.level)}
                  className={cls}
                  style={{ minHeight: 88 }}
                >
                  {isAiSuggested && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 whitespace-nowrap">
                      AI pick
                    </span>
                  )}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    isUserSelected ? 'bg-white/20 text-white' : disabled ? 'bg-gray-200 text-gray-400' : `${lvl.iconBg} ${lvl.iconText}`
                  }`}>
                    {lvl.icon}
                  </div>
                  <span className={`text-[11px] font-semibold text-center leading-tight ${
                    isUserSelected ? 'text-white' : disabled ? 'text-gray-400' : lvl.textIdle
                  }`}>
                    {lvl.label}
                  </span>
                  {/* Always reserve space for the chip — invisible when not selected */}
                  <span className={`text-[8px] font-bold border rounded-full px-1.5 py-0.5 mt-0.5 transition-all ${
                    isUserSelected
                      ? 'text-white/90 border-white/30 visible'
                      : 'invisible border-transparent text-transparent'
                  }`}>
                    Your verdict ✓
                  </span>
                </button>
              )
            })}
          </div>
          <p className={`text-[10px] text-center mt-3 ${notStarted ? 'text-gray-300' : 'text-gray-400'}`}>
            {notStarted
              ? 'Verdicts unlock once the IC deliberation completes.'
              : pending
                ? 'The IC will deliver its recommendation once the debate concludes.'
                : icVerdict
                  ? `You recorded: ${IC_LEVELS.find(l => l.level === icVerdict)?.label}. Click again to deselect.`
                  : 'Click a verdict to record your IC decision.'}
          </p>
        </div>
      </div>
    </div>
  )
}
