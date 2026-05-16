import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/media\//, ''))
  if (!key) return new Response('Not Found', { status: 404 })

  const media = getStore('media')
  const result = await media.getWithMetadata(key, { type: 'arrayBuffer' })
  if (!result) return new Response('Not Found', { status: 404 })

  const contentType = (result.metadata?.contentType as string) || 'application/octet-stream'
  return new Response(result.data as ArrayBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export const config: Config = {
  path: '/api/media/*',
  method: 'GET',
}
