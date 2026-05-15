import asyncio
import random
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from agents import (
    ingestion_agent, gap_detector_agent, evaluate_agent_llm, synthesis_agent,
    support_agent, opposition_agent, ic_decision_agent,
    ic_member_agent, _aggregate_member_votes, IC_MEMBERS,
)

EVAL_AGENTS = ['team', 'market', 'product', 'traction', 'business_model', 'competition', 'financials', 'risk']

DEFAULT_IC_WEIGHTS = {
    'team': 0.20, 'market': 0.15, 'product': 0.15, 'business_model': 0.15,
    'traction': 0.15, 'competition': 0.10, 'financials': 0.05, 'risk': 0.05,
}


class DDState(TypedDict, total=False):
    api_key: str
    combined_text: str
    profile: dict
    gaps: list
    scores: dict
    synthesis: dict
    support_text: str
    opposition_text: str
    queue: Any  # asyncio.Queue — not serializable but fine for in-process use


def _build_graph() -> StateGraph:
    graph = StateGraph(DDState)

    async def ingestion_node(state: DDState) -> dict:
        q: asyncio.Queue = state['queue']
        await q.put({'type': 'status', 'step': 'ingestion', 'message': 'Ingestion Agent is extracting company data…'})
        profile = await ingestion_agent(state['combined_text'], state['api_key'])
        await q.put({'type': 'profile', 'step': 'ingestion', 'data': profile})
        return {'profile': profile}

    async def gap_node(state: DDState) -> dict:
        q: asyncio.Queue = state['queue']
        await q.put({'type': 'status', 'step': 'gap_detector', 'message': 'Gap Detector is analyzing missing information…'})
        gaps = await gap_detector_agent(state['profile'], state['api_key'])
        await q.put({'type': 'gaps', 'step': 'gap_detector', 'data': gaps})
        return {'gaps': gaps}

    async def evaluate_node(state: DDState) -> dict:
        q: asyncio.Queue = state['queue']
        await q.put({
            'type': 'status', 'step': 'agents',
            'message': 'Running 8 specialist agents in parallel…',
        })
        # Emit agent_started events so the UI can light up borders before the LLM responds
        for name in EVAL_AGENTS:
            await q.put({'type': 'agent_started', 'agent': name})

        async def run_one(name: str) -> tuple[str, int]:
            # tiny jitter so the 8 LLM calls don't all start in the same millisecond
            await asyncio.sleep(random.uniform(0.0, 0.4))
            result = await evaluate_agent_llm(name, state['profile'], state['api_key'])
            await q.put({'type': 'score', 'step': 'agents', 'data': result})
            return name, result['score']

        results = await asyncio.gather(*[run_one(n) for n in EVAL_AGENTS])
        return {'scores': dict(results)}

    async def synthesis_node(state: DDState) -> dict:
        q: asyncio.Queue = state['queue']
        await q.put({'type': 'status', 'step': 'synthesis', 'message': 'Synthesizing investment memo…'})
        synth = await synthesis_agent(state['profile'], state['scores'], state['api_key'])
        await q.put({'type': 'synthesis', 'step': 'synthesis', 'data': synth})
        return {'synthesis': synth}

    async def debate_node(state: DDState) -> dict:
        q: asyncio.Queue = state['queue']
        await q.put({
            'type': 'status', 'step': 'debate',
            'message': 'Support and Opposition agents debating simultaneously…',
        })
        support_text, opposition_text = await asyncio.gather(
            support_agent(state['profile'], state['scores'], state['api_key'], q),
            opposition_agent(state['profile'], state['scores'], state['api_key'], q),
        )
        return {'support_text': support_text, 'opposition_text': opposition_text}

    async def ic_node(state: DDState) -> dict:
        q: asyncio.Queue = state['queue']
        await q.put({'type': 'status', 'step': 'ic', 'message': '3 IC committee members deliberating independently…'})

        overall = round(sum(state['scores'].get(k, 65) * w for k, w in DEFAULT_IC_WEIGHTS.items()))
        profile        = state['profile']
        scores         = state['scores']
        support_text   = state.get('support_text', '')
        opposition_text= state.get('opposition_text', '')
        gaps           = state.get('gaps', [])
        api_key        = state['api_key']

        # Run 3 IC member votes in parallel; emit each vote as it arrives
        async def vote_one(member: dict) -> dict:
            result = await ic_member_agent(
                member, profile, scores, overall,
                support_text, opposition_text, gaps, api_key,
            )
            await q.put({'type': 'ic_member_voted', 'data': result})
            return result

        member_votes = await asyncio.gather(*[vote_one(m) for m in IC_MEMBERS])
        decision = _aggregate_member_votes(list(member_votes), overall)

        await q.put({'type': 'ic_ready', 'data': decision})
        await q.put({'type': 'complete'})
        return {}

    graph.add_node('ingestion', ingestion_node)
    graph.add_node('gap_detector', gap_node)
    graph.add_node('evaluate', evaluate_node)
    graph.add_node('synthesis', synthesis_node)
    graph.add_node('debate', debate_node)
    graph.add_node('ic', ic_node)

    graph.set_entry_point('ingestion')
    graph.add_edge('ingestion', 'gap_detector')
    graph.add_edge('gap_detector', 'evaluate')
    graph.add_edge('evaluate', 'synthesis')
    graph.add_edge('synthesis', 'debate')
    graph.add_edge('debate', 'ic')
    graph.add_edge('ic', END)

    return graph.compile()


_compiled = _build_graph()


async def run_workflow(combined_text: str, api_key: str, queue: asyncio.Queue) -> None:
    try:
        await _compiled.ainvoke({
            'api_key': api_key,
            'combined_text': combined_text,
            'profile': {},
            'gaps': [],
            'scores': {},
            'synthesis': {},
            'support_text': '',
            'opposition_text': '',
            'queue': queue,
        })
    except Exception as e:
        await queue.put({'type': 'error', 'message': str(e)})
