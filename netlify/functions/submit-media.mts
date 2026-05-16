import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_DIRECT_BYTES = 4.5 * 1024 * 1024
const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|gif|webp|heic)|video\/(mp4|webm|quicktime|ogg))$/i

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function sanitize(str: unknown, max = 200): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, max).trim()
}

async function assembleChunks(
  uploads: ReturnType<typeof getStore>,
  media: ReturnType<typeof getStore>,
  file: { uploadId: string; chunks: number; name: string; type: string; size: number },
  parentId: string,
): Promise<{ key: string; type: string; name: string; kind: 'image' | 'video' }> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`הקובץ ${file.name} גדול מדי. מקסימום 25MB`)
  }
  if (!ALLOWED_MIME.test(file.type)) {
    throw new Error(`סוג קובץ לא נתמך: ${file.name}`)
  }

  const parts: ArrayBuffer[] = []
  for (let i = 0; i < file.chunks; i++) {
    const chunkKey = `${file.uploadId}/chunk-${String(i).padStart(4, '0')}`
    const chunk = await uploads.get(chunkKey, { type: 'arrayBuffer' })
    if (!chunk) {
      throw new Error(`חסר חלק ${i} מהקובץ ${file.name}`)
    }
    parts.push(chunk)
  }

  const totalSize = parts.reduce((s, p) => s + p.byteLength, 0)
  const combined = new Uint8Array(totalSize)
  let offset = 0
  for (const part of parts) {
    combined.set(new Uint8Array(part), offset)
    offset += part.byteLength
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const mediaKey = `${parentId}/${newId()}.${ext}`
  await media.set(mediaKey, combined.buffer, { metadata: { contentType: file.type } })

  for (let i = 0; i < file.chunks; i++) {
    const chunkKey = `${file.uploadId}/chunk-${String(i).padStart(4, '0')}`
    await uploads.delete(chunkKey)
  }

  return {
    key: mediaKey,
    type: file.type,
    name: file.name.slice(0, 200),
    kind: file.type.startsWith('video/') ? 'video' : 'image',
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const contentType = req.headers.get('content-type') || ''
  const submissions = getStore('submissions')
  const media = getStore('media')
  const uploads = getStore('uploads')
  const id = newId()

  if (contentType.includes('application/json')) {
    let body: {
      submitter?: string
      caption?: string
      files?: Array<{ uploadId: string; chunks: number; name: string; type: string; size: number }>
    }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const submitter = sanitize(body.submitter, 100)
    const caption = sanitize(body.caption, 500)
    const files = body.files

    if (!Array.isArray(files) || !files.length) {
      return Response.json({ error: 'יש לבחור לפחות קובץ אחד' }, { status: 400 })
    }

    const mediaEntries: Array<{ key: string; type: string; name: string; kind: 'image' | 'video' }> = []

    try {
      for (const file of files.slice(0, 8)) {
        if (!file.uploadId || !file.chunks || !file.name || !file.type) {
          return Response.json({ error: 'נתוני קובץ חסרים' }, { status: 400 })
        }
        const entry = await assembleChunks(uploads, media, file, id)
        mediaEntries.push(entry)
      }
    } catch (err: any) {
      return Response.json({ error: err.message || 'שגיאה בהרכבת הקבצים' }, { status: 400 })
    }

    const record = {
      id,
      type: 'media' as const,
      submitter: submitter || 'אנונימי',
      caption,
      media: mediaEntries,
      submittedAt: new Date().toISOString(),
    }

    await submissions.setJSON(`pending/media/${id}.json`, record)
    return Response.json({ ok: true, id })
  }

  if (contentType.includes('multipart/form-data')) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return Response.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const submitter = sanitize(form.get('submitter'), 100)
    const caption = sanitize(form.get('caption'), 500)

    const files = form.getAll('files').filter((v): v is File => v instanceof File && v.size > 0)
    if (!files.length) {
      return Response.json({ error: 'יש לבחור לפחות קובץ אחד' }, { status: 400 })
    }

    const mediaEntries: Array<{ key: string; type: string; name: string; kind: 'image' | 'video' }> = []

    for (const file of files.slice(0, 8)) {
      if (file.size > MAX_DIRECT_BYTES) {
        return Response.json(
          { error: `הקובץ ${file.name} גדול מדי להעלאה ישירה. השתמשו בממשק ההעלאה המעודכן.` },
          { status: 400 },
        )
      }
      if (!ALLOWED_MIME.test(file.type)) {
        return Response.json({ error: `סוג קובץ לא נתמך: ${file.name}` }, { status: 400 })
      }
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
      const mediaKey = `${id}/${newId()}.${ext}`
      const buf = await file.arrayBuffer()
      await media.set(mediaKey, buf, { metadata: { contentType: file.type } })
      mediaEntries.push({
        key: mediaKey,
        type: file.type,
        name: file.name.slice(0, 200),
        kind: file.type.startsWith('video/') ? 'video' : 'image',
      })
    }

    const record = {
      id,
      type: 'media' as const,
      submitter: submitter || 'אנונימי',
      caption,
      media: mediaEntries,
      submittedAt: new Date().toISOString(),
    }

    await submissions.setJSON(`pending/media/${id}.json`, record)
    return Response.json({ ok: true, id })
  }

  return Response.json({ error: 'Expected JSON or multipart/form-data' }, { status: 400 })
}

export const config: Config = {
  path: '/api/submit-media',
  method: 'POST',
}
