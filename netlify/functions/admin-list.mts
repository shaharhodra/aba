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

  const url = new URL(req.url)
  const kind = url.searchParams.get('type')
  if (kind !== 'recipe' && kind !== 'guestbook' && kind !== 'media' && kind !== 'restaurant') {
    return Response.json({ error: 'invalid type' }, { status: 400 })
  }

  const submissions = getStore('submissions')
  const prefix = `pending/${kind}/`
  const { blobs } = await submissions.list({ prefix })

  const items = await Promise.all(
    blobs.map(async (b) => submissions.get(b.key, { type: 'json' })),
  )

  const valid = items.filter((x): x is Record<string, any> => !!x)
  valid.sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''))

  return Response.json({ items: valid })
}

export const config: Config = {
  path: '/api/admin/list-pending',
  method: 'GET',
}
