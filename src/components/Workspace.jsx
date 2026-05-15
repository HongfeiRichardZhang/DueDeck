import { useState } from 'react'
import Row1Cards from './Row1Cards'
import AgentScores from './AgentScores'
import Row3Panels from './Row3Panels'
import DebatePanel from './DebatePanel'
import ICDecisionPanel from './ICDecisionPanel'
import { AlertCircle, RotateCcw } from 'lucide-react'

function ResetModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-80 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Reset analysis?</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            This will clear the current analysis results but keep your uploaded source documents.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

function PhaseHeader({ number, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100 whitespace-nowrap">
        Phase {number}
      </span>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

export default function Workspace({
  status, pipelineStep, pipelineMsg,
  profile, gaps, agentScores, synthesis, error,
  weights, onWeightsChange, overallScore,
  onReset, apiKey, customFormula, onFormulaChange,
  supportText, oppositionText, supportDone, oppositionDone,
  icSuggestion, icVerdict, onIcVerdict, icMemberVotes,
}) {
  const [showResetModal, setShowResetModal] = useState(false)
  const hasResults = profile || synthesis || agentScores.some(a => a.score != null)

  function handleConfirmReset() {
    setShowResetModal(false)
    onReset()
  }

  return (
    <main className="flex-1 min-w-0 overflow-auto bg-gray-50">
      {showResetModal && (
        <ResetModal onConfirm={handleConfirmReset} onCancel={() => setShowResetModal(false)} />
      )}

      <div className="min-w-[900px]">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 bg-white">
          <h1 className="text-sm font-semibold text-gray-900">Analysis Workspace</h1>
          {hasResults && (
            <button
              onClick={() => setShowResetModal(true)}
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Analysis failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <Row1Cards
            profile={profile} gaps={gaps} synthesis={synthesis}
            overallScore={overallScore} status={status}
            pipelineStep={pipelineStep}
          />

          <PhaseHeader number={1} label="Multi-Agent Evaluation" />

          <AgentScores
            agentScores={agentScores} pipelineStep={pipelineStep}
            weights={weights} onWeightsChange={onWeightsChange}
            overallScore={overallScore} profile={profile} apiKey={apiKey}
            customFormula={customFormula} onFormulaChange={onFormulaChange}
          />

          <PhaseHeader number={2} label="Parallel Debate" />
          <DebatePanel
            supportText={supportText}
            oppositionText={oppositionText}
            supportDone={supportDone}
            oppositionDone={oppositionDone}
            pipelineStep={pipelineStep}
          />

          <PhaseHeader number={3} label="IC Decision" />
          <ICDecisionPanel
            icSuggestion={icSuggestion}
            icVerdict={icVerdict}
            onIcVerdict={onIcVerdict}
            pipelineStep={pipelineStep}
            icMemberVotes={icMemberVotes}
          />

          <Row3Panels
            agentScores={agentScores} synthesis={synthesis} profile={profile}
            icSuggestion={icSuggestion} icVerdict={icVerdict}
          />

          <p className="text-xs text-gray-400 text-center pb-1">
            Scores and insights are generated by AI agents. Review before making decisions.
          </p>
        </div>
      </div>
    </main>
  )
}
