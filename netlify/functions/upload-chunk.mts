import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const MAX_CHUNK_BYTES = 4.5 * 1024 * 1024

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const uploadId = req.headers.get('x-upload-id')
  const chunkIndex = req.headers.get('x-chunk-index')

  if (!uploadId || !/^[a-z0-9-]{6,40}$/.test(uploadId)) {
    return Response.json({ error: 'Missing or invalid x-upload-id' }, { status: 400 })
  }
  if (chunkIndex == null || !/^\d{1,4}$/.test(chunkIndex)) {
    return Response.json({ error: 'Missing or invalid x-chunk-index' }, { status: 400 })
  }

  const body = await req.arrayBuffer()
  if (!body.byteLength) {
    return Response.json({ error: 'Empty chunk' }, { status: 400 })
  }
  if (body.byteLength > MAX_CHUNK_BYTES) {
    return Response.json({ error: 'Chunk too large' }, { status: 400 })
  }

  const uploads = getStore('uploads')
  await uploads.set(`${uploadId}/chunk-${chunkIndex.padStart(4, '0')}`, body)

  return Response.json({ ok: true })
}

export const config: Config = {
  path: '/api/upload-chunk',
  method: 'POST',
}
