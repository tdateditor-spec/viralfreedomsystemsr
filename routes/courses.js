const express  = require('express')
const supabase = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
const uid = () => Math.random().toString(36).slice(2,8).toUpperCase()

/* Auto-detect duration từ YouTube URL */
function secsToStr(n) {
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = Math.floor(n % 60)
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}

async function fetchYouTubeMeta(url) {
  const ytId = (url?.match(/(?:youtu\.be\/|[?&]v=)([^&\s]+)/) || [])[1]
  if (!ytId) return null
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    // Duration
    let duration = null
    const iso = html.match(/"duration":"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/)
    if (iso) {
      const total = (parseInt(iso[1])||0)*3600 + (parseInt(iso[2])||0)*60 + (parseInt(iso[3])||0)
      if (total > 0) duration = secsToStr(total)
    }
    if (!duration) {
      const len = html.match(/"lengthSeconds":"(\d+)"/)
      if (len) duration = secsToStr(parseInt(len[1]))
    }

    // Title
    const titleMatch = html.match(/"title":"([^"]+)"/)
    const title = titleMatch ? titleMatch[1].replace(/\\u[\dA-F]{4}/gi, m =>
      String.fromCharCode(parseInt(m.replace(/\\u/,''), 16))) : null

    // Thumbnail
    const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`

    return { duration, title, thumbnail, videoId: ytId }
  } catch {}
  return null
}

async function detectDuration(url) {
  const meta = await fetchYouTubeMeta(url)
  return meta?.duration || null
}

// GET /api/courses/video-metadata?url=... — lấy metadata video (title, duration, thumbnail)
router.get('/video-metadata', requireAuth, async (req, res) => {
  const meta = await fetchYouTubeMeta(req.query.url)
  if (!meta) return res.status(404).json({ error: 'Không thể lấy metadata' })
  res.json(meta)
})

// GET /api/courses — lấy toàn bộ chapters + lessons
router.get('/', requireAuth, async (req, res) => {
  const { data: chapters, error: chErr } = await supabase
    .from('chapters')
    .select('*')
    .order('order')

  if (chErr) return res.status(500).json({ error: chErr.message })

  const { data: lessons, error: lErr } = await supabase
    .from('lessons')
    .select('*')
    .order('order')

  if (lErr) return res.status(500).json({ error: lErr.message })

  // Ghép lessons vào chapters
  const result = chapters.map(ch => ({
    ...ch,
    lessons: lessons
      .filter(l => l.chapter_id === ch.id)
      .map(l => ({
        id: l.id,
        order: l.order,
        title: l.title,
        duration: l.duration,
        free: l.free,
        videoUrl: l.video_url,
        keyPoints: l.key_points || '',
        content: l.content || '',
        tags: l.tags || '',
      }))
  }))

  res.json({ chapters: result })
})

// POST /api/courses/chapters — thêm chương
router.post('/chapters', requireAuth, async (req, res) => {
  const { title, description } = req.body
  if (!title) return res.status(400).json({ error: 'Thiếu tiêu đề chương' })

  const { data: existing } = await supabase.from('chapters').select('order').order('order', { ascending: false }).limit(1)
  const nextOrder = existing?.length ? existing[0].order + 1 : 1

  const chapter = { id: 'C' + uid(), order: nextOrder, title, description: description || '' }
  const { data, error } = await supabase.from('chapters').insert(chapter).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ...data, lessons: [] })
})

// PUT /api/courses/chapters/:cid — sửa chương
router.put('/chapters/:cid', requireAuth, async (req, res) => {
  const updates = {}
  if (req.body.title !== undefined)       updates.title       = req.body.title
  if (req.body.description !== undefined) updates.description = req.body.description

  const { data, error } = await supabase
    .from('chapters').update(updates).eq('id', req.params.cid).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/courses/chapters/:cid — xoá chương (cascade xoá lessons)
router.delete('/chapters/:cid', requireAuth, async (req, res) => {
  const { error } = await supabase.from('chapters').delete().eq('id', req.params.cid)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// POST /api/courses/chapters/:cid/lessons — thêm bài học
router.post('/chapters/:cid/lessons', requireAuth, async (req, res) => {
  const { title, duration, free, videoUrl, keyPoints, content, tags } = req.body
  if (!title) return res.status(400).json({ error: 'Thiếu tiêu đề bài học' })

  const { data: existing } = await supabase
    .from('lessons').select('order').eq('chapter_id', req.params.cid)
    .order('order', { ascending: false }).limit(1)
  const nextOrder = existing?.length ? existing[0].order + 1 : 1

  const autoDur = await detectDuration(videoUrl)
  const lesson = {
    id: 'L' + uid(),
    chapter_id: req.params.cid,
    order: nextOrder,
    title,
    duration: autoDur || duration || '00:00',
    free: free || false,
    video_url: videoUrl || '',
    key_points: keyPoints || '',
    content: content || '',
    tags: tags || '',
  }

  const { data, error } = await supabase.from('lessons').insert(lesson).select().single()
  if (error) return res.status(500).json({ error: error.message })

  res.status(201).json({ ...data, videoUrl: data.video_url, keyPoints: data.key_points || '', content: data.content || '', tags: data.tags || '' })
})

// PUT /api/courses/chapters/:cid/lessons/:lid — sửa bài học
router.put('/chapters/:cid/lessons/:lid', requireAuth, async (req, res) => {
  const updates = {}
  if (req.body.title     !== undefined) updates.title      = req.body.title
  if (req.body.free      !== undefined) updates.free       = req.body.free
  if (req.body.keyPoints !== undefined) updates.key_points = req.body.keyPoints
  if (req.body.content   !== undefined) updates.content    = req.body.content
  if (req.body.tags      !== undefined) updates.tags       = req.body.tags
  if (req.body.videoUrl  !== undefined) {
    updates.video_url = req.body.videoUrl
    // Auto-detect duration từ YouTube khi videoUrl thay đổi
    const autoDur = await detectDuration(req.body.videoUrl)
    updates.duration = autoDur || req.body.duration || updates.duration
  } else if (req.body.duration !== undefined) {
    updates.duration = req.body.duration
  }

  const { data, error } = await supabase
    .from('lessons').update(updates).eq('id', req.params.lid).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ...data, videoUrl: data.video_url, keyPoints: data.key_points || '', content: data.content || '', tags: data.tags || '' })
})

// DELETE /api/courses/chapters/:cid/lessons/:lid — xoá bài học
router.delete('/chapters/:cid/lessons/:lid', requireAuth, async (req, res) => {
  const { error } = await supabase.from('lessons').delete().eq('id', req.params.lid)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// GET /api/courses/progress — lấy danh sách lesson đã hoàn thành của user
router.get('/progress', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('lesson_completions')
    .select('lesson_id')
    .eq('user_id', String(req.user.id))
  if (error) return res.status(500).json({ error: error.message })
  res.json({ done: data.map(r => r.lesson_id) })
})

// POST /api/courses/progress/:lessonId — đánh dấu bài học hoàn thành
router.post('/progress/:lessonId', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('lesson_completions')
    .upsert(
      { user_id: String(req.user.id), lesson_id: req.params.lessonId },
      { onConflict: 'user_id,lesson_id' }
    )
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

module.exports = router
