const express  = require('express')
const supabase = require('../db')

const router = express.Router()

// Xoá học viên pending chưa thanh toán quá 5 phút
async function cleanupExpiredPending() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('paid', false)
    .eq('status', 'pending')
    .lt('created_at', cutoff)
  if (error) console.warn('⚠️ Cleanup error:', error.message)
  else console.log('🧹 Đã xoá pending quá hạn')
}

/* ─── POST /api/register — Học viên đăng ký trước khi thanh toán ─────────── */
router.post('/', async (req, res) => {
  // Dọn dẹp pending cũ mỗi lần có đăng ký mới
  cleanupExpiredPending().catch(() => {})
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

/* ─── GET /api/register/status?email=xxx — Check payment status ──────────── */
router.get('/status', async (req, res) => {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'Thiếu email' })

  const { data } = await supabase
    .from('students')
    .select('paid, status')
    .eq('email', email)
    .single()

  if (!data) return res.json({ found: false, paid: false })
  res.json({ found: true, paid: data.paid, status: data.status })
})

module.exports = router
