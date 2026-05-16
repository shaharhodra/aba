import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function sanitize(str: unknown, max = 5000): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, max).trim()
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

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

  const name = sanitize(payload?.name, 100)
  const message = sanitize(payload?.message, 5000)
  const relation = sanitize(payload?.relation, 100)

  if (!name || !message) {
    return Response.json({ error: 'נדרש שם והודעה' }, { status: 400 })
  }

  const links: { url: string; title: string }[] = []
  if (Array.isArray(payload?.links)) {
    for (const l of payload.links.slice(0, 10)) {
      const url = sanitize(l?.url, 500)
      const title = sanitize(l?.title, 100)
      if (url && isValidUrl(url)) {
        links.push({ url, title })
      }
    }
  }

  const id = newId()
  const submissions = getStore('submissions')

  const record: Record<string, any> = {
    id,
    type: 'guestbook' as const,
    name,
    relation,
    message,
    submittedAt: new Date().toISOString(),
  }

  if (links.length) {
    record.links = links
  }

  await submissions.setJSON(`pending/guestbook/${id}.json`, record)

  return Response.json({ ok: true, id })
}

export const config: Config = {
  path: '/api/submit-guestbook',
  method: 'POST',
}
