import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function sanitize(str: unknown, max = 500): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, max).trim()
}

const VALID_TYPES = ['recipe', 'guestbook', 'media']

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetType = sanitize(payload?.targetType, 20)
  const targetId = sanitize(payload?.targetId, 50)
  const name = sanitize(payload?.name, 100)
  const text = sanitize(payload?.text, 2000)

  if (!VALID_TYPES.includes(targetType) || !targetId || !name || !text) {
    return Response.json({ error: 'נדרש שם וטקסט תגובה' }, { status: 400 })
  }

  const submissions = getStore('submissions')
  const targetKey = `approved/${targetType}/${targetId}.json`
  const target = await submissions.get(targetKey, { type: 'json' })
  if (!target) {
    return Response.json({ error: 'הפריט לא נמצא' }, { status: 404 })
  }

  const comments = getStore('comments')
  const id = newId()

  const record = {
    id,
    targetType,
    targetId,
    name,
    text,
    submittedAt: new Date().toISOString(),
  }

  await comments.setJSON(`${targetType}/${targetId}/${id}.json`, record)

  return Response.json({ ok: true, id })
}

export const config: Config = {
  path: '/api/submit-comment',
  method: 'POST',
}
