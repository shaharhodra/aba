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

export default async (req: Request, _context: Context) => {
  const guard = await ensureAdmin()
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, id } = body || {}
  if ((type !== 'recipe' && type !== 'guestbook' && type !== 'media' && type !== 'restaurant') || typeof id !== 'string') {
    return Response.json({ error: 'invalid args' }, { status: 400 })
  }

  const submissions = getStore('submissions')
  const pendingKey = `pending/${type}/${id}.json`
  const approvedKey = `approved/${type}/${id}.json`

  const record = await submissions.get(pendingKey, { type: 'json' })
  if (!record) return Response.json({ error: 'not found' }, { status: 404 })

  const approved = { ...(record as object), approvedAt: new Date().toISOString() }
  await submissions.setJSON(approvedKey, approved)
  await submissions.delete(pendingKey)

  return Response.json({ ok: true })
}

export const config: Config = {
  path: '/api/admin/approve',
  method: 'POST',
}
