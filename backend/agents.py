import json
import re
import random
from typing import Any

CHAT_SYS = """You are a VC analyst assistant helping an investor analyze a company. \
The investor has uploaded the company's pitch deck and/or business plan. \
Answer questions accurately based on the document content below. \
If the information is not present in the documents, say so clearly. \
Be concise and direct.

--- DOCUMENT CONTENT ---
{text}
--- END OF DOCUMENT ---"""

# ── Prompts ──────────────────────────────────────────────────────────────────

INGESTION_SYS = "You are an expert VC analyst. Extract structured information from business plan or pitch deck text. Return ONLY valid JSON, no other text."

INGESTION_USER = """Extract structured information from the text below.
Return ONLY a valid JSON object (null for any field not found):
{{
  "company_name": "company name",
  "founded": "year",
  "location": "city, country",
  "stage": "MUST be exactly one of: pre-seed, angel, seed, pre-a, series-a, series-b, growth. If not stated explicitly, infer from funding ask amount, team size, revenue/traction signals. Only use 'unknown' if there is truly no basis to infer.",
  "funding_ask": "amount (e.g. $2M)",
  "valuation": "valuation if mentioned",
  "description": "2-3 sentence company description",
  "market": "target market",
  "tam": "total addressable market size",
  "business_model": "how they make money",
  "revenue_model": "pricing / revenue structure",
  "team": [{{"name": "full name", "role": "title", "background": "1-2 sentences"}}],
  "traction": "key traction summary",
  "arr_mrr": "ARR or MRR if mentioned",
  "growth_rate": "growth % if mentioned",
  "competitors": ["competitor1", "competitor2"],
  "differentiation": "key competitive advantages",
  "financials": {{"burn_rate": null, "runway": null, "revenue": null}},
  "risks": ["risk1", "risk2"],
  "runway": "months of runway",
  "use_of_funds": "how funds will be used"
}}

Text:
{text}"""

GAP_SYS = "You are a VC analyst identifying due diligence information gaps. Return ONLY valid JSON."

GAP_USER = """Analyze this company profile and identify the 5 most critical missing pieces of information for VC due diligence.

Profile:
{profile}

Return ONLY a JSON array:
[
  {{"field": "short label", "text": "Specific actionable suggestion", "importance": "critical"}},
  {{"field": "short label", "text": "...", "importance": "high"}},
  {{"field": "short label", "text": "...", "importance": "high"}},
  {{"field": "short label", "text": "...", "importance": "medium"}},
  {{"field": "short label", "text": "...", "importance": "medium"}}
]"""

SYNTHESIS_SYS = "You are a senior VC partner writing an investment memo synthesis. Return ONLY valid JSON."

SYNTHESIS_USER = """Company: {company_name}
Description: {description}
Agent Scores (out of 100): {scores}

Return ONLY valid JSON:
{{
  "recommendation": "one of: Proceed to deeper diligence | Pass at this stage | Promising, needs more data | Strong investment signal",
  "recommendation_detail": "one sentence explanation",
  "key_strengths": ["strength1", "strength2", "strength3"],
  "key_concerns": ["concern1", "concern2"],
  "suggested_questions": ["q1?", "q2?", "q3?", "q4?", "q5?"]
}}"""

# ── Provider detection ────────────────────────────────────────────────────────

def detect_provider(api_key: str) -> str:
    return 'anthropic' if api_key.startswith('sk-ant') else 'openai'


# ── LLM call ─────────────────────────────────────────────────────────────────

async def stream_llm(system: str, user: str, api_key: str):
    """Async generator that yields text chunks from the LLM."""
    provider = detect_provider(api_key)
    if provider == 'anthropic':
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        async with client.messages.stream(
            model='claude-sonnet-4-6',
            max_tokens=1024,
            system=system,
            messages=[{'role': 'user', 'content': user}],
        ) as s:
            async for text in s.text_stream:
                yield text
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        stream = await client.chat.completions.create(
            model='gpt-4o',
            stream=True,
            max_tokens=1024,
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


async def call_llm(system: str, user: str, api_key: str) -> str:
    provider = detect_provider(api_key)
    if provider == 'anthropic':
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        msg = await client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=4096,
            system=system,
            messages=[{'role': 'user', 'content': user}],
        )
        return msg.content[0].text
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        resp = await client.chat.completions.create(
            model='gpt-4o',
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
            response_format={'type': 'json_object'},
            max_tokens=4096,
        )
        return resp.choices[0].message.content


def _parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


# ── Agents ────────────────────────────────────────────────────────────────────

async def ingestion_agent(text: str, api_key: str) -> dict:
    truncated = text[:12000]
    raw = await call_llm(INGESTION_SYS, INGESTION_USER.format(text=truncated), api_key)
    result = _parse_json(raw)
    if not isinstance(result, dict):
        result = {'company_name': 'Unknown', 'description': 'Could not parse document.'}
    return result


async def gap_detector_agent(profile: dict, api_key: str) -> list:
    raw = await call_llm(GAP_SYS, GAP_USER.format(profile=json.dumps(profile, indent=2)), api_key)
    result = _parse_json(raw)
    if not isinstance(result, list):
        return [{'field': 'documents', 'text': 'Upload additional supporting documents.', 'importance': 'medium'}]
    return result


_BASE = {'team': 74, 'market': 71, 'product': 76, 'traction': 63,
         'business_model': 69, 'competition': 66, 'financials': 58, 'risk': 60}

_BONUS = {
    'team':           lambda p: 10 if p.get('team') else -6,
    'market':         lambda p: 9 if p.get('tam') else -9,
    'product':        lambda p: 7 if p.get('differentiation') else -7,
    'traction':       lambda p: 13 if p.get('arr_mrr') else -11,
    'business_model': lambda p: 8 if p.get('revenue_model') else -8,
    'competition':    lambda p: 6 if p.get('competitors') else -6,
    'financials':     lambda p: 9 if (p.get('financials') or {}).get('runway') else -9,
    'risk':           lambda p: -6 if len(p.get('risks') or []) > 2 else 5,
}

_ANALYSIS = {
    'team':           lambda s, p: f"Team shows {'strong' if s > 75 else 'adequate'} domain expertise. {'Founders have documented backgrounds.' if p.get('team') else 'Team details are sparse — founder bios recommended.'}",
    'market':         lambda s, p: f"{'Market size quantified.' if p.get('tam') else 'TAM not stated — market sizing required.'} Opportunity appears {'large' if s > 74 else 'moderate'}.",
    'product':        lambda s, p: f"Product shows {'clear' if p.get('differentiation') else 'unclear'} differentiation. {'Strong moat evidence.' if s > 79 else 'Deeper product validation needed.'}",
    'traction':       lambda s, p: f"{'Revenue metrics present.' if p.get('arr_mrr') else 'No revenue data — historical MRR needed.'} Growth is {'encouraging' if s > 68 else 'early-stage'}.",
    'business_model': lambda s, p: f"{'Revenue model outlined.' if p.get('revenue_model') else 'Revenue model unclear.'} Unit economics {'look viable' if s > 71 else 'need validation'}.",
    'competition':    lambda s, p: f"{'Competitive landscape mapped.' if p.get('competitors') else 'Competitors not identified.'} Positioning is {'differentiated' if s > 68 else 'unclear'}.",
    'financials':     lambda s, p: f"{'Runway disclosed.' if (p.get('financials') or {}).get('runway') else 'Runway not stated — financial model needed.'} Planning {'appears solid' if s > 63 else 'needs strengthening'}.",
    'risk':           lambda s, p: f"{'Multiple risks acknowledged.' if len(p.get('risks') or []) > 1 else 'Risk assessment limited.'} Overall risk profile {'manageable' if s > 62 else 'elevated'}.",
}


def mock_evaluate(agent_name: str, profile: dict) -> dict:
    score = min(95, max(40, _BASE[agent_name] + _BONUS[agent_name](profile) + random.randint(-4, 4)))
    return {
        'agent': agent_name,
        'score': score,
        'analysis': _ANALYSIS[agent_name](score, profile),
        'confidence': 'high' if score > 72 else 'medium' if score > 55 else 'low',
        'strengths': [],
        'weaknesses': [],
        'risks': [],
        'missing_info': [],
    }


# ── Real LLM-based 8 specialized agents (per DueDeck rules) ──────────────────

AGENT_RUBRICS = {
    'team': {
        'name': 'Team Analysis Agent',
        'goal': "Evaluate whether the founding team has the ability to execute and build this company.",
        'criteria': [
            "Founder background alignment with the venture direction",
            "Relevant industry experience",
            "Prior entrepreneurial or startup experience",
            "Product, technical, sales, or fundraising track record",
            "Team completeness (CEO, CTO, product, growth, BD, ops)",
            "Past successes or exits",
            "Execution ability and resource integration",
        ],
        'high': "Founders highly match the industry; core roles are complete; strong execution evidence, industry resources, prior entrepreneurial or fundraising experience.",
        'low':  "Team info missing; founder background unrelated; core roles absent; no execution evidence.",
        'output_fields': ['team_strengths', 'team_weaknesses', 'key_risks'],
    },
    'market': {
        'name': 'Market Analysis Agent',
        'goal': "Evaluate whether the market is large enough, fast-growing, and suitable for VC investment.",
        'criteria': [
            "Clarity of TAM / SAM / SOM",
            "Market size adequacy",
            "Market growth rate",
            "Strength of customer pain points",
            "Target customer clarity",
            "Market entry timing",
            "Policy, technology, or consumer-trend tailwinds",
            "Market crowding / competition density",
            "Venture-scale return potential",
        ],
        'high': "Large market, fast growth, real pain, clear demand, visible trends — fits VC return logic.",
        'low':  "Small or slowly growing market, vague needs, weak pain, overcrowded competition.",
        'output_fields': ['opportunity', 'market_sizing', 'industry_trend', 'market_risk'],
    },
    'product': {
        'name': 'Product Analysis Agent',
        'goal': "Evaluate whether the product solves a real problem and has differentiation and sustainable competitiveness.",
        'criteria': [
            "Clarity of problem solved",
            "Target user definition",
            "Specificity of core features",
            "Existence of demo, MVP, or shipped product",
            "User experience advantage",
            "Technical or data moats",
            "Replicability of the product",
            "Clear differentiation vs. competitors",
            "Quality of product roadmap",
        ],
        'high': "Product clear, validated, differentiated; solves real pain; has tech, data, process, or experience moats.",
        'low':  "Product concept vague; no demo; no real user feedback; weak differentiation; easily replicable.",
        'output_fields': ['product_strengths', 'product_weaknesses', 'differentiation', 'product_risk'],
    },
    'traction': {
        'name': 'Traction Analysis Agent',
        'goal': "Evaluate whether the project has obtained real market validation.",
        'criteria': [
            "User count / activity / paid users",
            "Revenue, MRR / ARR, GMV",
            "Customer count, pilot customers, LOIs, signed contracts",
            "Retention rate, conversion rate, repurchase rate",
            "Growth rate",
            "Pipeline, partnerships",
            "Customer feedback",
        ],
        'high': "Real users, paying customers, revenue or pilots; clear growth trend; healthy retention and conversion.",
        'low':  "No users, customers, revenue, or pilots — only ideas or assumptions.",
        'output_fields': ['growth_highlights', 'validation_status', 'data_credibility', 'growth_risk'],
    },
    'business_model': {
        'name': 'Business Model Analysis Agent',
        'goal': "Evaluate how the company makes money and whether the business model is sustainable and scalable.",
        'criteria': [
            "Clarity of revenue model",
            "Pricing reasonableness",
            "Customer willingness to pay",
            "Sales cycle control",
            "Gross margin health",
            "CAC / LTV reasonableness",
            "Payback period",
            "Unit economics viability",
            "Scalability of business model",
            "GTM strategy clarity",
        ],
        'high': "Revenue model clear; strong willingness to pay; healthy gross margin; healthy CAC/LTV; scalable.",
        'low':  "Unclear monetization; vague pricing; missing CAC/LTV; long sales cycle; unclear path to commercialization.",
        'output_fields': ['revenue_model_view', 'unit_economics', 'commercialization_strengths', 'commercialization_risk'],
    },
    'competition': {
        'name': 'Competition Analysis Agent',
        'goal': "Evaluate the competitive landscape, differentiation, and moats.",
        'criteria': [
            "Identification of main competitors",
            "Alternative solutions",
            "Clarity of company positioning",
            "Differentiation vs. competitors",
            "Tech / data / brand / channel / cost / network-effect moats",
            "Risk of incumbents entering",
            "Whether competitors already dominate",
            "Defensive capability",
        ],
        'high': "Clear positioning; obvious differentiation; strong moats; hard to replicate quickly.",
        'low':  "Strong incumbents; weak differentiation; low entry barriers; easily copied by large players; vague positioning.",
        'output_fields': ['main_competitors', 'differentiation', 'moat_assessment', 'competition_risk'],
    },
    'financials': {
        'name': 'Financial Analysis Agent',
        'goal': "Evaluate financial health, funding needs, runway, and valuation reasonableness.",
        'criteria': [
            "Current / historical revenue and revenue projection",
            "Cost structure and monthly burn",
            "Cash balance and runway",
            "Raise amount and use of funds",
            "Valuation and cap table",
            "12-24 month budget",
            "Reasonableness of financial model assumptions",
        ],
        'high': "Financial model clear; burn controlled; reasonable runway; specific use of funds; valuation matches stage and traction.",
        'low':  "Financial data missing; burn unclear; runway unclear; valuation has no basis; overly optimistic projections.",
        'output_fields': ['financial_health', 'valuation_view', 'runway_view', 'financial_risk'],
    },
    'risk': {
        'name': 'Risk Analysis Agent',
        'goal': "Evaluate the most likely reasons this project could fail.",
        'criteria': [
            "Market risk",
            "Team risk",
            "Product / technical risk",
            "Financial risk",
            "Competitive risk",
            "Regulatory risk",
            "Customer concentration risk",
            "Data authenticity risk",
            "Fundraising risk",
            "Execution risk",
            "Legal compliance risk",
        ],
        'high': "Risks clear, manageable, no obvious deal-breakers; company has reasonable mitigation plans.",
        'low':  "Major risks present with no mitigation; e.g. regulatory uncertainty, customer concentration, financial unsustainability, severe team gaps.",
        'output_fields': ['core_risks', 'risk_level', 'risk_impact', 'mitigation_suggestions'],
    },
}


def _eval_sys(agent_name: str) -> str:
    rubric = AGENT_RUBRICS[agent_name]
    return (
        f"You are the {rubric['name']} on a VC due-diligence team. "
        f"Goal: {rubric['goal']} "
        "Be specific and evidence-based. Use only what is provided. "
        "Return ONLY valid JSON, no other text."
    )


def _eval_user(agent_name: str, profile: dict) -> str:
    rubric = AGENT_RUBRICS[agent_name]
    profile_json = json.dumps(profile, indent=2, ensure_ascii=False)[:6000]
    criteria_block = "\n".join(f"- {c}" for c in rubric['criteria'])
    extra_fields_block = "\n".join(
        f'  "{f}": "1 short sentence",' for f in rubric.get('output_fields', [])
    )
    return f"""Company profile (structured data extracted from pitch deck / business plan):
{profile_json}

Evaluation criteria:
{criteria_block}

High-score standard: {rubric['high']}
Low-score standard:  {rubric['low']}

Return ONLY a JSON object in this exact shape:
{{
  "score": <integer 0-100>,
  "rationale": "1-2 sentence summary of why you assigned this score",
  "strengths": ["short bullet", "short bullet"],
  "weaknesses": ["short bullet", "short bullet"],
  "risks": ["short bullet", "short bullet"],
  "missing_info": ["short bullet that would change your score"],
  "confidence": "high|medium|low",
{extra_fields_block}
  "evidence": "1 sentence pointing at specific profile fields you used"
}}

If the profile is too sparse to judge, score conservatively (40-55) and list what's missing."""


async def evaluate_agent_llm(agent_name: str, profile: dict, api_key: str) -> dict:
    """Run a real LLM-driven evaluation for one of the 8 specialised agents.
    Falls back to mock_evaluate on parse/API failure."""
    try:
        raw = await call_llm(_eval_sys(agent_name), _eval_user(agent_name, profile), api_key)
        data = _parse_json(raw)
        if not isinstance(data, dict) or 'score' not in data:
            return mock_evaluate(agent_name, profile)

        score = data.get('score', 60)
        try:
            score = int(score)
        except (ValueError, TypeError):
            score = 60
        score = max(0, min(100, score))

        return {
            'agent': agent_name,
            'score': score,
            'analysis': data.get('rationale') or data.get('evidence') or '',
            'confidence': data.get('confidence', 'medium'),
            'strengths': data.get('strengths', []) or [],
            'weaknesses': data.get('weaknesses', []) or [],
            'risks': data.get('risks', []) or [],
            'missing_info': data.get('missing_info', []) or [],
            'extras': {k: v for k, v in data.items() if k not in (
                'score', 'rationale', 'confidence', 'strengths',
                'weaknesses', 'risks', 'missing_info', 'evidence',
            )},
        }
    except Exception:
        return mock_evaluate(agent_name, profile)


async def synthesis_agent(profile: dict, scores: dict, api_key: str) -> dict:
    weights = {'team': 0.20, 'market': 0.15, 'product': 0.15, 'business_model': 0.15,
               'traction': 0.15, 'competition': 0.10, 'financials': 0.05, 'risk': 0.05}
    overall = round(sum(scores.get(k, 65) * w for k, w in weights.items()))

    try:
        raw = await call_llm(
            SYNTHESIS_SYS,
            SYNTHESIS_USER.format(
                company_name=profile.get('company_name', 'Unknown'),
                description=profile.get('description', 'N/A'),
                scores=json.dumps({k: scores.get(k) for k in weights}, indent=2),
            ),
            api_key,
        )
        result = _parse_json(raw)
        if isinstance(result, dict):
            result['overall_score'] = overall
            return result
    except Exception:
        pass

    rec = ('Proceed to deeper diligence' if overall >= 75
           else 'Promising, needs more data' if overall >= 65
           else 'Pass at this stage')
    return {
        'overall_score': overall,
        'recommendation': rec,
        'recommendation_detail': 'Based on aggregated agent scores across all dimensions.',
        'key_strengths': ['Relevant market opportunity', 'Early team signals', 'Product differentiation'],
        'key_concerns': ['Limited financial data', 'Traction metrics incomplete'],
        'suggested_questions': [
            'What is your current MRR and month-over-month growth rate?',
            'How did you acquire your first 10 customers?',
            'What are your CAC and LTV by acquisition channel?',
            'What metrics will this round get you to for Series A?',
            'Who are your top 3 competitors and why do customers choose you?',
        ],
    }


FORMULA_SYS = "You are a VC scoring formula assistant. Convert the user's description into a JavaScript arithmetic expression. Return ONLY valid JSON."

FORMULA_USER = """Convert this scoring formula description into a JavaScript expression.

Available variables (each is a score from 0 to 100):
  team, market, product, traction, business_model, competition, financials, risk

Constraints:
- Use ONLY: the 8 variable names, numbers, arithmetic operators (+, -, *, /, **), Math.sqrt, Math.min, Math.max, Math.pow, Math.log, and parentheses
- The expression must return a value between 0 and 100
- No other JS code, no semicolons, no assignments, no function declarations

Also produce a short human-readable display string (use × for multiply, √ for sqrt, etc).

User description: {description}

Return ONLY valid JSON (no markdown):
{{"formula_expr": "team * 0.3 + market * 0.25 + product * 0.2 + traction * 0.15 + business_model * 0.05 + competition * 0.03 + financials * 0.01 + risk * 0.01", "formula_display": "Score = team×30% + market×25% + product×20% + traction×15% + …"}}"""


async def interpret_formula_agent(description: str, api_key: str) -> dict:
    raw = await call_llm(FORMULA_SYS, FORMULA_USER.format(description=description), api_key)
    result = _parse_json(raw)
    if not isinstance(result, dict) or 'formula_expr' not in result:
        raise ValueError('Could not parse formula from response')
    expr = result['formula_expr'].strip()
    display = result.get('formula_display', f'Score = {expr}').strip()
    # Basic safety: reject if expr contains anything other than allowed tokens
    import re as _re
    safe = _re.sub(r'(Math\.(sqrt|min|max|pow|log)|team|market|product|traction|business_model|competition|financials|risk|[\d\s\+\-\*\/\.\(\)\*\*])', '', expr)
    if safe.strip():
        raise ValueError(f'Formula contains disallowed tokens: {safe.strip()!r}')
    return {'formula_expr': expr, 'formula_display': display}


SUPPORT_SYS = (
    "You are the Support Agent on a VC investment committee — the partner arguing FOR pursuing this deal. "
    "You do NOT re-score. You build the strongest pro-investment case using the 8 specialist scores and the profile. "
    "Answer the question: 'Why is this project worth continuing to evaluate?' "
    "You may emphasize positives but you must NOT ignore obvious risks — flag where your support rests on unverified assumptions. "
    "Structure your output with bold markdown headers: "
    "**Core Investment Thesis** → **Top 3-5 Investment Highlights** → **Upside Potential** → "
    "**Why Proceed Now** → **Supporting Evidence** → **What's Still Missing (but won't block)**. "
    "Write 300-400 words."
)

SUPPORT_USER = (
    "Company: {company_name}\n"
    "Description: {description}\n"
    "8-agent specialist scores (0-100): {scores}\n"
    "Structured profile data: {profile_summary}\n\n"
    "Build the strongest possible investment case."
)

OPPOSITION_SYS = (
    "You are the Opposition Agent on a VC investment committee — the partner challenging this deal to prevent over-optimism. "
    "You do NOT re-score. You build the strongest anti-investment case using the 8 specialist scores and the profile. "
    "Answer the question: 'Why might this project NOT be worth investing in?' "
    "Do not oppose for opposition's sake — if risks are acceptable, say why they can be managed. "
    "If you find a fatal risk, explicitly label it a DEAL BREAKER. "
    "Structure your output with bold markdown headers: "
    "**Core Opposition Thesis** → **Top 3-5 Risks** → **Key Assumption Gaps** → **Potential Deal Breakers** → "
    "**Questions Founders Must Answer** → **Supporting Evidence** → **Information Gaps Affecting Final Judgment**. "
    "Write 300-400 words."
)

OPPOSITION_USER = (
    "Company: {company_name}\n"
    "Description: {description}\n"
    "8-agent specialist scores (0-100): {scores}\n"
    "Structured profile data: {profile_summary}\n\n"
    "Build the strongest possible anti-investment case."
)


def _format_debate_context(profile: dict, scores: dict) -> tuple[str, str, str, str]:
    company_name = profile.get('company_name', 'Unknown')
    description = profile.get('description', 'N/A')
    scores_str = json.dumps(scores, indent=2)
    # Compact profile summary (exclude team list verbosity)
    summary = {k: v for k, v in profile.items() if k not in ('team',) and v}
    profile_summary = json.dumps(summary, indent=2)[:2000]
    return company_name, description, scores_str, profile_summary


async def support_agent(profile: dict, scores: dict, api_key: str, queue) -> str:
    company_name, description, scores_str, profile_summary = _format_debate_context(profile, scores)
    user = SUPPORT_USER.format(
        company_name=company_name,
        description=description,
        scores=scores_str,
        profile_summary=profile_summary,
    )
    full = ""
    async for chunk in stream_llm(SUPPORT_SYS, user, api_key):
        full += chunk
        await queue.put({'type': 'debate_chunk', 'agent': 'support', 'chunk': chunk})
    await queue.put({'type': 'debate_done', 'agent': 'support'})
    return full


async def opposition_agent(profile: dict, scores: dict, api_key: str, queue) -> str:
    company_name, description, scores_str, profile_summary = _format_debate_context(profile, scores)
    user = OPPOSITION_USER.format(
        company_name=company_name,
        description=description,
        scores=scores_str,
        profile_summary=profile_summary,
    )
    full = ""
    async for chunk in stream_llm(OPPOSITION_SYS, user, api_key):
        full += chunk
        await queue.put({'type': 'debate_chunk', 'agent': 'opposition', 'chunk': chunk})
    await queue.put({'type': 'debate_done', 'agent': 'opposition'})
    return full


def _fallback_ic_decision(overall_score: int) -> dict:
    """Simple rule-based fallback if LLM call fails. DueDeck targets early-stage
    private-market investing where over-confident verdicts are inappropriate."""
    if overall_score >= 72:
        return {
            'level': 1, 'label': 'Invest',
            'reasoning': f'Overall score {overall_score}: enough upside with manageable risk; advance to the next stage of the investment process.',
            'rationale_points': ['Strong overall signal', 'No identified deal-breakers'],
            'red_flags': [],
            'questions_for_founders': [],
        }
    if overall_score >= 58:
        return {
            'level': 2, 'label': 'Need More Diligence',
            'reasoning': f'Overall score {overall_score}: potential is present but critical data is missing; request more material before judging.',
            'rationale_points': ['Mid-range scores', 'Information gaps blocking judgement'],
            'red_flags': [],
            'questions_for_founders': [],
        }
    if overall_score >= 48:
        return {
            'level': 3, 'label': 'Watchlist',
            'reasoning': f'Overall score {overall_score}: not investable today, but the direction is attractive. Observe over the next 3-6 months for traction or team build-out.',
            'rationale_points': ['Below current bar', 'Worth revisiting after milestones'],
            'red_flags': [],
            'questions_for_founders': [],
        }
    return {
        'level': 4, 'label': 'Pass',
        'reasoning': f'Overall score {overall_score}: risk-reward does not match, or material hard issues exist. Do not proceed.',
        'rationale_points': ['Below threshold', 'Multiple weak dimensions'],
        'red_flags': [],
        'questions_for_founders': [],
    }


IC_SYS = (
    "You are the IC (Investment Committee) Agent — the final decision-maker simulating a VC investment committee. "
    "DueDeck targets EARLY-STAGE PRIVATE-MARKET investing, where uncertainty is high — you must NOT return over-confident "
    "verdicts like 'Strong Invest' or 'Strong Pass'. You do NOT simply average the scores. You synthesise: the 8 specialist "
    "agent scores, the Support Agent's case, the Opposition Agent's case, data completeness, missing critical inputs, "
    "risk level, the company's funding stage, industry, valuation reasonableness, and quality of evidence. "
    "You may ONLY return one of FOUR verdicts: 'Invest', 'Need More Diligence', 'Watchlist', or 'Pass'. "
    "Apply stage-appropriate standards: Pre-seed can tolerate weak financials but not missing team info. "
    "Seed needs at least some users / pilots / clear traction. Pre-A requires real traction, revenue, and business model evidence. "
    "Return ONLY valid JSON, no other text."
)

IC_USER = """Company: {company_name}
Stage: {stage}
Description: {description}

8 Specialist Agent Scores (0-100):
{scores}

Weighted Overall Score: {overall_score}/100

Support Agent argument:
{support_text}

Opposition Agent argument:
{opposition_text}

Missing critical inputs ({gap_count} gaps): {gaps}

Decide ONE verdict from: "Invest", "Need More Diligence", "Watchlist", "Pass".

Decision rules:
- Invest: enough upside, risk is acceptable, no deal-breakers — proceed to the next step of the investment process. At least 2 strong dimensions among team/market/product; opposition concerns are non-fatal; weaknesses match the funding stage.
- Need More Diligence: project has potential but critical data is missing; supplement materials before re-judging. Both Support and Opposition have valid points; completeness is insufficient; key risks can't yet be judged.
- Watchlist: do not invest now, but the direction is attractive. Recommend observing for 3-6 months — the team or market needs more time to demonstrate traction, or a milestone (revenue, product launch, hire) would change the picture. Use this when you cannot honestly say "Invest" but it would feel wrong to permanently "Pass".
- Pass: risk-reward does not match, OR a clear hard issue exists (team obviously mismatched, market too small, weak differentiation, traction inadequate for stage, financial risk too high, valuation unreasonable, regulatory deal-breaker, or Opposition identified a clear deal-breaker). Do not recommend proceeding.

Return ONLY JSON:
{{
  "verdict": "Invest" | "Need More Diligence" | "Watchlist" | "Pass",
  "reasoning": "2-3 sentences explaining the verdict — reference specific signals from the data",
  "rationale_points": ["bullet 1", "bullet 2", "bullet 3"],
  "red_flags": ["bullet", "bullet"],
  "questions_for_founders": ["question 1", "question 2", "question 3"]
}}"""


_VERDICT_LEVEL = {
    'Invest':              1,
    'Need More Diligence': 2,
    'Watchlist':           3,
    'Pass':                4,
}

# ── 3 Independent IC Committee Members ───────────────────────────────────────

IC_MEMBERS = [
    {
        'id': 'managing_partner',
        'name': 'Sarah Chen',
        'role': 'Managing Partner',
        'focus': 'Downside risk & portfolio fit',
        'persona': 'Senior and experienced. Prioritises capital preservation and portfolio-level fit. Has seen many failures — high bar for conviction.',
        'photo': 'women/26',
    },
    {
        'id': 'general_partner',
        'name': 'Marcus Reid',
        'role': 'General Partner',
        'focus': 'Team quality & market timing',
        'persona': 'Analytical and balanced. Focuses on founder-market fit, team pedigree, and whether the timing is right for this market.',
        'photo': 'men/41',
    },
    {
        'id': 'principal',
        'name': 'Priya Sharma',
        'role': 'Principal',
        'focus': 'Growth trajectory & innovation',
        'persona': 'Growth-oriented and optimistic. Willing to back early signals for asymmetric upside. Excited by differentiation and market disruption.',
        'photo': 'women/63',
    },
]

IC_MEMBER_SYS = (
    "You are the {role} at an early-stage VC fund. "
    "Your investment focus: {focus}. "
    "Your style: {persona} "
    "You are one of three IC members independently reviewing a deal. "
    "Make your own vote — do NOT try to guess what others will say. "
    "Only one of four verdicts: 'Invest' | 'Need More Diligence' | 'Watchlist' | 'Pass'. "
    "Return ONLY valid JSON, no other text."
)

IC_MEMBER_USER = """Company: {company_name} | Stage: {stage} | Weighted Score: {overall_score}/100

8 Specialist Agent Scores:
{scores}

Pro-Investment Summary:
{support_summary}

Anti-Investment Summary:
{opposition_summary}

Critical data gaps: {gaps}

You are the {role}. Your lens: {focus}.

Return ONLY this JSON:
{{
  "vote": "Invest | Need More Diligence | Watchlist | Pass",
  "confidence": "high | medium | low",
  "reasoning": "2-3 sentences from your perspective as {role}.",
  "key_concern": "one critical concern or empty string",
  "question_for_founders": "one key question you would ask or empty string"
}}"""


async def ic_member_agent(member: dict, profile: dict, scores: dict, overall_score: int,
                           support_text: str, opposition_text: str, gaps: list, api_key: str) -> dict:
    """One IC committee member casts an independent vote."""
    gap_summary = '; '.join(g.get('field', '') for g in gaps[:5]) or 'none flagged'
    sys_prompt = IC_MEMBER_SYS.format(
        role=member['role'],
        focus=member['focus'], persona=member['persona'],
    )
    user_prompt = IC_MEMBER_USER.format(
        company_name=profile.get('company_name', 'Unknown'),
        stage=profile.get('stage', 'unknown'),
        overall_score=overall_score,
        scores=json.dumps(scores, indent=2),
        support_summary=(support_text or 'unavailable')[:1200],
        opposition_summary=(opposition_text or 'unavailable')[:1200],
        gaps=gap_summary,
        role=member['role'], focus=member['focus'],
    )
    try:
        raw = await call_llm(sys_prompt, user_prompt, api_key)
        data = _parse_json(raw)
        if not isinstance(data, dict) or 'vote' not in data:
            raise ValueError('bad response')
        vote = data.get('vote', '').strip()
        # normalise
        for v in _VERDICT_LEVEL:
            if v.lower() in vote.lower():
                vote = v
                break
        if vote not in _VERDICT_LEVEL:
            vote = 'Need More Diligence'
        return {
            'member_id':            member['id'],
            'name':                 member['name'],
            'role':                 member['role'],
            'vote':                 vote,
            'level':                _VERDICT_LEVEL[vote],
            'confidence':           data.get('confidence', 'medium'),
            'reasoning':            data.get('reasoning', ''),
            'key_concern':          data.get('key_concern', ''),
            'question_for_founders': data.get('question_for_founders', ''),
        }
    except Exception:
        # Fallback: use overall_score heuristic
        fallback = _fallback_ic_decision(overall_score)
        return {
            'member_id':            member['id'],
            'name':                 member['name'],
            'role':                 member['role'],
            'vote':                 fallback['label'],
            'level':                fallback['level'],
            'confidence':           'low',
            'reasoning':            fallback['reasoning'],
            'key_concern':          '',
            'question_for_founders': '',
        }


def _aggregate_member_votes(member_votes: list, overall_score: int) -> dict:
    """Majority vote; Managing Partner breaks ties. Returns full ic_ready payload."""
    vote_counts: dict[str, int] = {}
    for mv in member_votes:
        vote_counts[mv['vote']] = vote_counts.get(mv['vote'], 0) + 1

    # Majority (2 or 3 agree)
    winner = max(vote_counts, key=vote_counts.get)
    if vote_counts[winner] < 2:
        # All 3 different — Managing Partner (index 0) decides
        winner = member_votes[0]['vote']

    level = _VERDICT_LEVEL.get(winner, 2)

    # Build reasoning from member summaries
    summaries = [f"{mv['name']} ({mv['role']}): {mv['reasoning']}" for mv in member_votes if mv['reasoning']]
    reasoning = ' | '.join(summaries)

    rationale_points = [f"{mv['name']} voted '{mv['vote']}' ({mv['confidence']} confidence)" for mv in member_votes]
    red_flags       = [mv['key_concern'] for mv in member_votes if mv.get('key_concern')]
    questions       = [mv['question_for_founders'] for mv in member_votes if mv.get('question_for_founders')]

    return {
        'level':                  level,
        'label':                  winner,
        'reasoning':              reasoning[:600],
        'rationale_points':       rationale_points,
        'red_flags':              red_flags,
        'questions_for_founders': questions,
        'member_votes':           member_votes,
        'vote_tally':             vote_counts,
    }


async def ic_decision_agent(
    profile: dict,
    scores: dict,
    overall_score: int,
    support_text: str,
    opposition_text: str,
    gaps: list,
    api_key: str,
) -> dict:
    try:
        gap_summary = '; '.join(g.get('field', '') for g in gaps[:8]) or 'none flagged'
        raw = await call_llm(
            IC_SYS,
            IC_USER.format(
                company_name=profile.get('company_name', 'Unknown'),
                stage=profile.get('stage', 'unknown'),
                description=profile.get('description', 'N/A')[:600],
                scores=json.dumps(scores, indent=2),
                overall_score=overall_score,
                support_text=(support_text or 'unavailable')[:2000],
                opposition_text=(opposition_text or 'unavailable')[:2000],
                gap_count=len(gaps),
                gaps=gap_summary,
            ),
            api_key,
        )
        data = _parse_json(raw)
        if not isinstance(data, dict) or 'verdict' not in data:
            return _fallback_ic_decision(overall_score)

        verdict = data.get('verdict', '').strip()
        level = _VERDICT_LEVEL.get(verdict)
        if level is None:
            # Best-effort match
            for v, lvl in _VERDICT_LEVEL.items():
                if v.lower() in verdict.lower():
                    verdict, level = v, lvl
                    break
            else:
                return _fallback_ic_decision(overall_score)

        return {
            'level': level,
            'label': verdict,
            'reasoning': data.get('reasoning', ''),
            'rationale_points': data.get('rationale_points', []) or [],
            'red_flags': data.get('red_flags', []) or [],
            'questions_for_founders': data.get('questions_for_founders', []) or [],
        }
    except Exception:
        return _fallback_ic_decision(overall_score)


# Backward-compat alias: keep callers happy that import compute_ic_suggestion
def compute_ic_suggestion(overall_score: int) -> dict:
    return _fallback_ic_decision(overall_score)


async def chat_agent(document_text: str, message: str, history: list, api_key: str) -> str:
    system = CHAT_SYS.format(text=document_text[:12000])
    provider = detect_provider(api_key)

    if provider == 'anthropic':
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        messages = [{'role': m['role'], 'content': m['content']} for m in history]
        messages.append({'role': 'user', 'content': message})
        resp = await client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        return resp.content[0].text
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        msgs = [{'role': 'system', 'content': system}]
        msgs += [{'role': m['role'], 'content': m['content']} for m in history]
        msgs.append({'role': 'user', 'content': message})
        resp = await client.chat.completions.create(
            model='gpt-4o',
            messages=msgs,
            max_tokens=1024,
        )
        return resp.choices[0].message.content
