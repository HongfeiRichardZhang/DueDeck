export async function uploadFiles(files) {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function* streamAnalysis(sessionId, apiKey) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, api_key: apiKey }),
  })
  if (!res.ok) throw new Error(await res.text())

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim()
        if (raw) {
          try { yield JSON.parse(raw) } catch (_) {}
        }
      }
    }
  }
}
