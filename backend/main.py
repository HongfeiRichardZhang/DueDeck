import asyncio
import json
import uuid

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import re

from parser import extract_text
from workflow import run_workflow
from agents import chat_agent, interpret_formula_agent


def detect_stage_from_text(text: str) -> str | None:
    t = text.lower()
    # English patterns (specific → general)
    if re.search(r'pre[- ]?seed', t): return 'pre-seed'
    if re.search(r'(pre[- ]?series[- ]?a|pre[- ]?a\b)', t): return 'pre-a'
    if re.search(r'series[- ]?a\b', t): return 'pre-a'
    if re.search(r'\bangel\b', t): return 'angel'
    if re.search(r'\bseed\b.{0,80}(round|invest|fund|stage|raise|capital)', t): return 'seed'
    if re.search(r'(round|invest|fund|stage|raising|capital).{0,80}\bseed\b', t): return 'seed'
    # Infer from funding ask amount (rough heuristic)
    m = re.search(r'\$\s*([\d,.]+)\s*(k|m|million|thousand)?', t)
    if m:
        raw = float(m.group(1).replace(',', ''))
        unit = (m.group(2) or '').lower()
        amount = raw * (1_000_000 if unit in ('m', 'million') else 1_000 if unit in ('k', 'thousand') else 1)
        if amount < 500_000: return 'pre-seed'
        if amount < 3_000_000: return 'seed'
        if amount < 8_000_000: return 'pre-a'
    return None

app = FastAPI(title='DueDeck API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# In-memory session store (MVP: single process)
sessions: dict[str, dict] = {}


@app.post('/api/upload')
async def upload(files: list[UploadFile] = File(...)):
    session_id = str(uuid.uuid4())
    texts = []
    file_infos = []

    for f in files:
        content = await f.read()
        text = extract_text(content, f.filename or 'file')
        texts.append(text)
        file_infos.append({'name': f.filename, 'size': len(content)})

    sessions[session_id] = {'texts': texts, 'files': file_infos}
    return {'session_id': session_id, 'files': file_infos}


class AnalyzeRequest(BaseModel):
    session_id: str
    api_key: str


@app.post('/api/analyze')
async def analyze(req: AnalyzeRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail='Session not found')

    combined_text = '\n\n---\n\n'.join(sessions[req.session_id]['texts'])
    queue: asyncio.Queue = asyncio.Queue()

    async def stream():
        task = asyncio.create_task(run_workflow(combined_text, req.api_key, queue))
        try:
            while True:
                event = await queue.get()
                yield f'data: {json.dumps(event)}\n\n'
                if event.get('type') in ('complete', 'error'):
                    break
        finally:
            task.cancel()

    return StreamingResponse(
        stream(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


class ChatRequest(BaseModel):
    session_id: str
    api_key: str
    message: str
    history: list = []


@app.post('/api/chat')
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail='Session not found')
    combined_text = '\n\n---\n\n'.join(sessions[req.session_id]['texts'])
    try:
        response = await chat_agent(combined_text, req.message, req.history, req.api_key)
        return {'response': response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FormulaRequest(BaseModel):
    description: str
    api_key: str


@app.post('/api/interpret_formula')
async def interpret_formula(req: FormulaRequest):
    try:
        result = await interpret_formula_agent(req.description, req.api_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
