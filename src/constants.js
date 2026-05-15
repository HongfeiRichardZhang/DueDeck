export const AGENT_META = [
  { key: 'team',           label: 'Team',           sub: 'Analysis Agent', color: '#8b5cf6', icon: '👥' },
  { key: 'market',         label: 'Market',         sub: 'Analysis Agent', color: '#3b82f6', icon: '🎯' },
  { key: 'product',        label: 'Product',        sub: 'Analysis Agent', color: '#06b6d4', icon: '📦' },
  { key: 'traction',       label: 'Traction',       sub: 'Analysis Agent', color: '#10b981', icon: '📈' },
  { key: 'business_model', label: 'Business Model', sub: 'Analysis Agent', color: '#f59e0b', icon: '💼' },
  { key: 'competition',    label: 'Competition',    sub: 'Analysis Agent', color: '#ef4444', icon: '⚔️'  },
  { key: 'financials',     label: 'Financials',     sub: 'Analysis Agent', color: '#6366f1', icon: '📊' },
  { key: 'risk',           label: 'Risk',           sub: 'Analysis Agent', color: '#f43f5e', icon: '🛡️' },
]

export const DEFAULT_WEIGHTS = {
  team: 30, market: 25, product: 20, traction: 10,
  business_model: 5, competition: 5, financials: 2, risk: 3,
}
