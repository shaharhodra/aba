import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const kind = url.searchParams.get('type')

  if (kind !== 'recipe' && kind !== 'guestbook' && kind !== 'media' && kind !== 'restaurant') {
    return Response.json({ error: 'invalid type' }, { status: 400 })
  }

  const submissions = getStore('submissions')
  const prefix = `approved/${kind}/`
  const { blobs } = await submissions.list({ prefix })

  const items = await Promise.all(
    blobs.map(async (b) => {
      const data = await submissions.get(b.key, { type: 'json' })
      return data
    }),
  )

  const valid = items.filter((x): x is Record<string, any> => !!x)
  valid.sort((a, b) => (b.approvedAt || b.submittedAt || '').localeCompare(a.approvedAt || a.submittedAt || ''))

  return Response.json({ items: valid })
}

export const config: Config = {
  path: '/api/list-approved',
  method: 'GET',
}
