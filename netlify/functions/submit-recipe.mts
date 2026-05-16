import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|gif|webp|heic)|video\/(mp4|webm|quicktime|ogg))$/i

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function sanitize(str: unknown, max = 5000): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, max).trim()
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const title = sanitize(form.get('title'), 200)
  const submitter = sanitize(form.get('submitter'), 100)
  const content = sanitize(form.get('content'), 10000)

  if (!title || !content) {
    return Response.json({ error: 'נדרש להזין שם וגם תוכן למתכון' }, { status: 400 })
  }

  const id = newId()
  const submissions = getStore('submissions')
  const media = getStore('media')

  const mediaEntries: Array<{ key: string; type: string; name: string }> = []

  const files = form.getAll('files').filter((v): v is File => v instanceof File && v.size > 0)
  for (const file of files.slice(0, 6)) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `הקובץ ${file.name} גדול מדי. מקסימום 5MB` }, { status: 400 })
    }
    if (!ALLOWED_MIME.test(file.type)) {
      return Response.json({ error: `סוג קובץ לא נתמך: ${file.name}` }, { status: 400 })
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    const mediaKey = `${id}/${newId()}.${ext}`
    const buf = await file.arrayBuffer()
    await media.set(mediaKey, buf, { metadata: { contentType: file.type } })
    mediaEntries.push({ key: mediaKey, type: file.type, name: file.name.slice(0, 200) })
  }

  const record = {
    id,
    type: 'recipe' as const,
    title,
    content,
    submitter: submitter || 'אנונימי',
    media: mediaEntries,
    submittedAt: new Date().toISOString(),
  }

  await submissions.setJSON(`pending/recipe/${id}.json`, record)

  return Response.json({ ok: true, id })
}

export const config: Config = {
  path: '/api/submit-recipe',
  method: 'POST',
}
