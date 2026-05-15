import { useState, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import Workspace from './components/Workspace'
import { uploadFiles, streamAnalysis } from './api'
import { AGENT_META, DEFAULT_WEIGHTS } from './constants'

const blankScores = () => AGENT_META.map(a => ({ ...a, score: null, analysis: null }))

export default function App() {
  const [apiKey, setApiKey]             = useState('')
  const [keyConfirmed, setKeyConfirmed] = useState(false)
  const [files, setFiles]               = useState([])
  const [sessionId, setSessionId]       = useState(null)
  const [status, setStatus]             = useState('idle')
  const [pipelineStep, setPipelineStep] = useState(null)
  const [pipelineMsg, setPipelineMsg]   = useState('')
  const [profile, setProfile]           = useState(null)
  const [gaps, setGaps]                 = useState([])
  const [agentScores, setAgentScores]   = useState(blankScores())
  const [synthesis, setSynthesis]       = useState(null)
  const [error, setError]               = useState(null)
  const [weights, setWeights]           = useState({ ...DEFAULT_WEIGHTS })
  const [customFormula, setCustomFormula] = useState(null) // {expr, display} | null
  const [supportText, setSupportText]       = useState('')
  const [oppositionText, setOppositionText] = useState('')
  const [supportDone, setSupportDone]       = useState(false)
  const [oppositionDone, setOppositionDone] = useState(false)
  const [icSuggestion, setIcSuggestion]     = useState(null)
  const [icVerdict, setIcVerdict]           = useState(null)
  const [icMemberVotes, setIcMemberVotes]   = useState({})

  // Recompute overall score whenever weights, scores, or formula change
  const overallScore = useMemo(() => {
    const scored = agentScores.filter(a => a.score != null)
    if (scored.length === 0) return synthesis?.overall_score ?? null

    if (customFormula?.expr) {
      const vars = {}
      agentScores.forEach(a => { vars[a.key] = a.score ?? 0 })
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(...Object.keys(vars), `return (${customFormula.expr})`)
        const raw = fn(...Object.values(vars))
        return Math.round(Math.max(0, Math.min(100, raw)))
      } catch { return null }
    }

    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    if (total === 0) return null
    const sum = scored.reduce((acc, a) => acc + a.score * ((weights[a.key] ?? 0) / 100), 0)
    const coverage = scored.reduce((acc, a) => acc + ((weights[a.key] ?? 0) / 100), 0)
    return coverage > 0 ? Math.round(sum / coverage) : null
  }, [agentScores, weights, synthesis, customFormula])

  async function handleFilesSelected(newFiles) {
    setStatus('uploading')
    const uploading = Array.from(newFiles).map(f => ({
      name: f.name, size: f.size, type: f.name.split('.').pop().toLowerCase(),
      status: 'uploading', file: f,
    }))
    setFiles(prev => [...prev, ...uploading])
    try {
      const res = await uploadFiles(Array.from(newFiles))
      setSessionId(res.session_id)
      setFiles(prev => prev.map(f =>
        uploading.find(u => u.name === f.name) ? { ...f, status: 'parsed' } : f
      ))
      setStatus('ready')
    } catch (e) {
      setError(e.message); setStatus('error')
    }
  }

  function handleFileRemove(fileName) {
    setFiles(prev => prev.filter(f => f.name !== fileName))
  }

  function handleReset() {
    setProfile(null)
    setGaps([])
    setAgentScores(blankScores())
    setSynthesis(null)
    setPipelineStep(null)
    setPipelineMsg('')
    setError(null)
    setCustomFormula(null)
    setSupportText('')
    setOppositionText('')
    setSupportDone(false)
    setOppositionDone(false)
    setIcSuggestion(null)
    setIcVerdict(null)
    setIcMemberVotes({})
    setStatus(files.some(f => f.status === 'parsed') ? 'ready' : 'idle')
  }

  async function handleStartAnalysis() {
    if (!sessionId || !keyConfirmed || status === 'analyzing') return
    setStatus('analyzing'); setError(null); setProfile(null)
    setGaps([]); setAgentScores(blankScores()); setSynthesis(null)
    setSupportText(''); setOppositionText(''); setSupportDone(false)
    setOppositionDone(false); setIcSuggestion(null); setIcVerdict(null); setIcMemberVotes({})
    try {
      for await (const event of streamAnalysis(sessionId, apiKey)) {
        if      (event.type === 'status')    { setPipelineStep(event.step); setPipelineMsg(event.message) }
        else if (event.type === 'profile')   { setProfile(event.data) }
        else if (event.type === 'gaps')      { setGaps(event.data) }
        else if (event.type === 'agent_started') {
          setAgentScores(prev => prev.map(a => a.key === event.agent ? { ...a, running: true } : a))
        }
        else if (event.type === 'score') {
          setAgentScores(prev => prev.map(a => a.key === event.data.agent ? {
            ...a,
            running: false,
            score: event.data.score,
            analysis: event.data.analysis,
            confidence: event.data.confidence,
            strengths: event.data.strengths,
            weaknesses: event.data.weaknesses,
            risks: event.data.risks,
            missing_info: event.data.missing_info,
            extras: event.data.extras,
          } : a))
        }
        else if (event.type === 'synthesis') { setSynthesis(event.data) }
        else if (event.type === 'debate_chunk') {
          event.agent === 'support'
            ? setSupportText(p => p + event.chunk)
            : setOppositionText(p => p + event.chunk)
        }
        else if (event.type === 'debate_done') {
          event.agent === 'support' ? setSupportDone(true) : setOppositionDone(true)
        }
        else if (event.type === 'ic_member_voted') {
          setIcMemberVotes(prev => ({ ...prev, [event.data.member_id]: event.data }))
        }
        else if (event.type === 'ic_ready')  { setIcSuggestion(event.data) }
        else if (event.type === 'complete')  { setStatus('complete'); setPipelineStep('done') }
        else if (event.type === 'error')     { setError(event.message); setStatus('error') }
      }
    } catch (e) { setError(e.message); setStatus('error') }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Top nav */}
      <div className="fixed top-0 right-0 left-0 h-12 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            {/* back card */}
            <rect x="5" y="5" width="18" height="18" rx="4" fill="url(#logoGrad)" opacity="0.35" />
            {/* mid card */}
            <rect x="3" y="7" width="18" height="18" rx="4" fill="url(#logoGrad)" opacity="0.6" />
            {/* front card */}
            <rect x="1" y="9" width="18" height="16" rx="4" fill="url(#logoGrad)" />
            {/* bar chart bars */}
            <rect x="4.5" y="19" width="2.5" height="4" rx="0.8" fill="white" opacity="0.9" />
            <rect x="8.5" y="16" width="2.5" height="7" rx="0.8" fill="white" opacity="0.9" />
            <rect x="12.5" y="13.5" width="2.5" height="9.5" rx="0.8" fill="white" opacity="0.9" />
            {/* checkmark */}
            <path d="M5 14.5 L8 17.5 L15 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
          </svg>
          <span className="text-sm font-bold tracking-tight">
            <span className="text-gray-900">Due</span><span className="text-blue-600">Deck</span>
          </span>
        </div>

      </div>

      <div className="flex w-full pt-12 overflow-hidden">
        <Sidebar
          apiKey={apiKey} onApiKeyChange={setApiKey}
          keyConfirmed={keyConfirmed} onConfirmKey={() => setKeyConfirmed(true)}
          files={files} onFilesSelected={handleFilesSelected}
          onFileRemove={handleFileRemove}
          onStartAnalysis={handleStartAnalysis} status={status}
          sessionId={sessionId} profile={profile}
        />
        <Workspace
          status={status} pipelineStep={pipelineStep} pipelineMsg={pipelineMsg}
          profile={profile} gaps={gaps} agentScores={agentScores}
          synthesis={synthesis} error={error}
          weights={weights} onWeightsChange={setWeights}
          overallScore={overallScore}
          onReset={handleReset} apiKey={apiKey}
          customFormula={customFormula} onFormulaChange={setCustomFormula}
          supportText={supportText} oppositionText={oppositionText}
          supportDone={supportDone} oppositionDone={oppositionDone}
          icSuggestion={icSuggestion} icVerdict={icVerdict} onIcVerdict={setIcVerdict}
          icMemberVotes={icMemberVotes}
        />
      </div>
    </div>
  )
}
