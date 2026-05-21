const express  = require('express')
const bcrypt   = require('bcryptjs')
const supabase = require('../db')
const { requireAuth } = require('../middleware/auth')
const { sendWelcomeEmail } = require('../lib/email')

const router = express.Router()

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function generateTempPassword() {
  const digits = Math.floor(1000 + Math.random() * 9000)
  const chars  = Math.random().toString(36).slice(2, 4).toUpperCase()
  return `VFS${digits}${chars}` // VD: VFS7342AB
}

/* ─── GET /api/users ──────────────────────────────────────────────────────── */
router.get('/', requireAuth, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1)
  const limit  = Math.min(50, parseInt(req.query.limit) || 10)
  const search = (req.query.search || '').trim()
  const status = req.query.status || ''

  const from = (page - 1) * limit
  const to   = from + limit - 1

  let query = supabase
    .from('students')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) return res.status(500).json({ error: error.message })

  res.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      hasNext: page < Math.ceil(count / limit),
      hasPrev: page > 1,
    }
  })
})

/* ─── POST /api/users — Admin tạo tài khoản học viên ─────────────────────── */
router.post('/', requireAuth, async (req, res) => {
  const { name, email, phone, paid, status } = req.body
  if (!name || !email) return res.status(400).json({ error: 'Thiếu tên hoặc email' })

  const now      = new Date()
  const joinDate = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`

  // Sinh mật khẩu tạm + mã hoá
  const tempPassword = generateTempPassword()
  const hashed       = await bcrypt.hash(tempPassword, 10)

  const { data, error } = await supabase
    .from('students')
    .insert({
      name,
      email,
      phone:                phone || '',
      status:               status || 'active',
      progress:             0,
      join_date:            joinDate,
      paid:                 paid !== undefined ? paid : true,
      password:             hashed,
      must_change_password: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email đã tồn tại' })
    return res.status(500).json({ error: error.message })
  }

  // Gửi email tài khoản cho học viên
  try {
    await sendWelcomeEmail({ name, email, tempPassword })
    console.log(`✅ Tạo tài khoản & gửi email: ${email} | Mật khẩu tạm: ${tempPassword}`)
  } catch (emailErr) {
    console.error('⚠️  Gửi email thất bại:', emailErr.message)
    // Không fail request — tài khoản đã tạo, admin có thể gửi lại sau
  }

  res.status(201).json({ ...data, tempPassword }) // trả về tempPassword để admin biết
})

/* ─── POST /api/users/:id/resend-email — Gửi lại email ───────────────────── */
router.post('/:id/resend-email', requireAuth, async (req, res) => {
  const { data: student } = await supabase
    .from('students').select('*').eq('id', req.params.id).single()

  if (!student) return res.status(404).json({ error: 'Không tìm thấy học viên' })

  // Sinh mật khẩu mới
  const tempPassword = generateTempPassword()
  const hashed       = await bcrypt.hash(tempPassword, 10)

  await supabase.from('students').update({
    password:             hashed,
    must_change_password: true,
  }).eq('id', student.id)

  try {
    await sendWelcomeEmail({ name: student.name, email: student.email, tempPassword })
    res.json({ ok: true, message: `Email đã gửi lại tới ${student.email}`, tempPassword })
  } catch (err) {
    res.status(500).json({ error: 'Gửi email thất bại: ' + err.message })
  }
})

/* ─── PUT /api/users/:id ──────────────────────────────────────────────────── */
router.put('/:id', requireAuth, async (req, res) => {
  const allowed = ['name','email','phone','status','progress','paid']
  const updates = {}
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })

  const { data, error } = await supabase
    .from('students').update(updates).eq('id', req.params.id).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ─── DELETE /api/users/:id ───────────────────────────────────────────────── */
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('students').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

module.exports = router
