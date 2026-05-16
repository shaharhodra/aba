import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function sanitize(str: unknown, max = 500): string {
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

  const restaurantName = sanitize(payload?.restaurantName, 200)
  const country = sanitize(payload?.country, 100)
  const city = sanitize(payload?.city, 100)
  const location = sanitize(payload?.location, 300)
  const link = sanitize(payload?.link, 500)
  const dish = sanitize(payload?.dish, 200)
  const dishDescription = sanitize(payload?.dishDescription, 1000)
  const submitter = sanitize(payload?.submitter, 100)

  if (!restaurantName || !country || !city) {
    return Response.json({ error: 'נדרש שם מסעדה, ארץ ועיר' }, { status: 400 })
  }

  if (link && !isValidUrl(link)) {
    return Response.json({ error: 'קישור לא תקין' }, { status: 400 })
  }

  const id = newId()
  const submissions = getStore('submissions')

  const record: Record<string, any> = {
    id,
    type: 'restaurant' as const,
    restaurantName,
    country,
    city,
    location,
    dish,
    dishDescription,
    submitter: submitter || 'אנונימי',
    submittedAt: new Date().toISOString(),
  }

  if (link) {
    record.link = link
  }

  await submissions.setJSON(`pending/restaurant/${id}.json`, record)

  return Response.json({ ok: true, id })
}

export const config: Config = {
  path: '/api/submit-restaurant',
  method: 'POST',
}
