import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const VALID_TYPES = ['recipe', 'guestbook', 'media']

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const targetType = url.searchParams.get('targetType')
  const targetId = url.searchParams.get('targetId')

  if (!targetType || !VALID_TYPES.includes(targetType) || !targetId) {
    return Response.json({ error: 'invalid params' }, { status: 400 })
  }

  const comments = getStore('comments')
  const prefix = `${targetType}/${targetId}/`
  const { blobs } = await comments.list({ prefix })

  const items = await Promise.all(
    blobs.map(async (b) => comments.get(b.key, { type: 'json' })),
  )

  const valid = items.filter((x): x is Record<string, any> => !!x)
  valid.sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''))

  return Response.json({ items: valid })
}

export const config: Config = {
  path: '/api/list-comments',
  method: 'GET',
}
