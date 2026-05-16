import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import type { Context, Config } from '@netlify/functions'

async function ensureAdmin(): Promise<Response | null> {
  try {
    const user = await getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const roles = user.roles || []
    if (!roles.includes('admin')) return new Response('Forbidden', { status: 403 })
    return null
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
}

const VALID_TYPES = ['recipe', 'guestbook', 'media']

export default async (req: Request, _context: Context) => {
  const guard = await ensureAdmin()
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { targetType, targetId, commentId } = body || {}
  if (!VALID_TYPES.includes(targetType) || typeof targetId !== 'string' || typeof commentId !== 'string') {
    return Response.json({ error: 'invalid args' }, { status: 400 })
  }

  const comments = getStore('comments')
  const key = `${targetType}/${targetId}/${commentId}.json`

  const record = await comments.get(key, { type: 'json' })
  if (!record) return Response.json({ error: 'not found' }, { status: 404 })

  await comments.delete(key)

  return Response.json({ ok: true })
}

export const config: Config = {
  path: '/api/admin/delete-comment',
  method: 'POST',
}
