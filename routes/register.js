const express  = require('express')
const supabase = require('../db')

const router = express.Router()

/* ─── POST /api/register — Học viên đăng ký trước khi thanh toán ─────────── */
router.post('/', async (req, res) => {
  const { name, email, phone } = req.body
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Thiếu thông tin' })
  }

  // Kiểm tra đã tồn tại chưa
  const { data: existing } = await supabase
    .from('students')
    .select('id, paid, status')
    .eq('email', email)
    .single()

  if (existing) {
    if (existing.paid) {
      return res.status(409).json({ error: 'Email này đã thanh toán rồi. Vui lòng kiểm tra hộp thư.' })
    }
    // Cập nhật lại thông tin nếu chưa thanh toán
    await supabase.from('students').update({ name, phone }).eq('id', existing.id)
    return res.json({ ok: true, message: 'Thông tin đã cập nhật' })
  }

  // Tạo mới với status pending
  const { error } = await supabase.from('students').insert({
    name,
    email,
    phone,
    status:               'pending',
    paid:                 false,
    progress:             0,
    password:             '',
    must_change_password: true,
  })

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email đã tồn tại' })
    return res.status(500).json({ error: error.message })
  }

  console.log(`📝 Đăng ký mới: ${name} <${email}> - ${phone}`)
  res.json({ ok: true })
})

module.exports = router
