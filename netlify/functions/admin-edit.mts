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

const VALID_TYPES = ['recipe', 'guestbook', 'media', 'restaurant']

export default async (req: Request, _context: Context) => {
  const guard = await ensureAdmin()
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, id, status, fields } = body || {}
  if (!VALID_TYPES.includes(type) || typeof id !== 'string') {
    return Response.json({ error: 'invalid args' }, { status: 400 })
  }
  if (status !== 'pending' && status !== 'approved') {
    return Response.json({ error: 'invalid status' }, { status: 400 })
  }
  if (!fields || typeof fields !== 'object') {
    return Response.json({ error: 'missing fields' }, { status: 400 })
  }

  const submissions = getStore('submissions')
  const key = `${status}/${type}/${id}.json`

  const record = await submissions.get(key, { type: 'json' }) as Record<string, any> | null
  if (!record) return Response.json({ error: 'not found' }, { status: 404 })

  if (type === 'recipe') {
    if (fields.title !== undefined) record.title = sanitize(fields.title, 200)
    if (fields.content !== undefined) record.content = sanitize(fields.content, 10000)
    if (fields.submitter !== undefined) record.submitter = sanitize(fields.submitter, 100)
  } else if (type === 'guestbook') {
    if (fields.name !== undefined) record.name = sanitize(fields.name, 100)
    if (fields.message !== undefined) record.message = sanitize(fields.message, 5000)
    if (fields.relation !== undefined) record.relation = sanitize(fields.relation, 100)
  } else if (type === 'media') {
    if (fields.submitter !== undefined) record.submitter = sanitize(fields.submitter, 100)
    if (fields.caption !== undefined) record.caption = sanitize(fields.caption, 500)
  } else if (type === 'restaurant') {
    if (fields.restaurantName !== undefined) record.restaurantName = sanitize(fields.restaurantName, 200)
    if (fields.country !== undefined) record.country = sanitize(fields.country, 100)
    if (fields.city !== undefined) record.city = sanitize(fields.city, 100)
    if (fields.location !== undefined) record.location = sanitize(fields.location, 300)
    if (fields.link !== undefined) {
      const link = sanitize(fields.link, 500)
      if (link && !isValidUrl(link)) {
        return Response.json({ error: 'קישור לא תקין' }, { status: 400 })
      }
      record.link = link
    }
    if (fields.dish !== undefined) record.dish = sanitize(fields.dish, 200)
    if (fields.dishDescription !== undefined) record.dishDescription = sanitize(fields.dishDescription, 1000)
    if (fields.submitter !== undefined) record.submitter = sanitize(fields.submitter, 100)
  }

  record.editedAt = new Date().toISOString()

  await submissions.setJSON(key, record)

  return Response.json({ ok: true })
}

export const config: Config = {
  path: '/api/admin/edit',
  method: 'POST',
}
