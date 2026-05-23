require('dotenv').config()
const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const supabase = require('../db')
const { JWT_SECRET } = require('../middleware/auth')
const { sendResetPasswordEmail } = require('../lib/email')

const router = express.Router()

/* ─── POST /api/auth/login ────────────────────────────────────────────────── */
// Kiểm tra admin trước, sau đó học viên
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' })

  // 1. Thử admin
  const { data: admin } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .single()

  if (admin) {
    const ok = await bcrypt.compare(password, admin.password)
    if (!ok) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    return res.json({ token, name: admin.name, role: 'admin', mustChangePassword: false })
  }

  // 2. Thử học viên
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', email)
    .single()

  if (!student)
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })

  if (!student.paid || student.status === 'inactive')
    return res.status(403).json({ error: 'Tài khoản chưa được kích hoạt. Vui lòng hoàn tất thanh toán.' })

  if (!student.password)
    return res.status(403).json({ error: 'Tài khoản chưa có mật khẩu. Vui lòng liên hệ hỗ trợ.' })

  const ok = await bcrypt.compare(password, student.password)
  if (!ok) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })

  const token = jwt.sign(
    { id: student.id, email: student.email, name: student.name, role: 'student' },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  return res.json({
    token,
    name:               student.name,
    role:               'student',
    mustChangePassword: student.must_change_password,
  })
})

/* ─── POST /api/auth/change-password ─────────────────────────────────────── */
router.post('/change-password', async (req, res) => {
  const { newPassword, oldPassword } = req.body
  if (!newPassword) return res.status(400).json({ error: 'Thiếu mật khẩu mới' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' })

  // Lấy user từ JWT token
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' })

  let payload
  try { payload = jwt.verify(auth.slice(7), JWT_SECRET) }
  catch { return res.status(401).json({ error: 'Token không hợp lệ' }) }

  // Admin
  if (payload.role === 'admin') {
    const { data: admin } = await supabase.from('admin_users').select('*').eq('id', payload.id).single()
    if (!admin) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
    if (oldPassword) {
      const ok = await bcrypt.compare(oldPassword, admin.password)
      if (!ok) return res.status(401).json({ error: 'Mật khẩu cũ không đúng' })
    }
    const hashed = await bcrypt.hash(newPassword, 10)
    await supabase.from('admin_users').update({ password: hashed }).eq('id', admin.id)
    return res.json({ message: 'Đổi mật khẩu thành công' })
  }

  // Học viên
  const { data: student } = await supabase.from('students').select('*').eq('id', payload.id).single()
  if (!student) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })

  // Nếu không phải lần đầu đổi → cần xác minh mật khẩu cũ
  if (!student.must_change_password) {
    if (!oldPassword) return res.status(400).json({ error: 'Vui lòng nhập mật khẩu cũ' })
    const ok = await bcrypt.compare(oldPassword, student.password)
    if (!ok) return res.status(401).json({ error: 'Mật khẩu cũ không đúng' })
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await supabase.from('students').update({
    password: hashed,
    must_change_password: false,
  }).eq('id', student.id)

  return res.json({ message: 'Đổi mật khẩu thành công' })
})

/* ─── POST /api/auth/forgot-password ─────────────────────────────────────── */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Vui lòng nhập email' })

  // Tìm học viên
  const { data: student } = await supabase
    .from('students').select('*').eq('email', email).single()

  // Luôn trả về thành công để không lộ email
  if (!student || !student.paid) {
    return res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.' })
  }

  // Tạo token ngẫu nhiên (1 giờ)
  const token   = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await supabase.from('students').update({
    reset_token:         token,
    reset_token_expires: expires,
  }).eq('id', student.id)

  try {
    await sendResetPasswordEmail({ name: student.name, email: student.email, token })
    console.log(`📧 Reset password email → ${student.email}`)
  } catch (err) {
    console.error('⚠️  Gửi email reset thất bại:', err.message)
  }

  return res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.' })
})

/* ─── POST /api/auth/reset-password ──────────────────────────────────────── */
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body
  if (!token || !newPassword) return res.status(400).json({ error: 'Thiếu token hoặc mật khẩu' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu phải ít nhất 6 ký tự' })

  // Tìm student theo token còn hạn
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('reset_token', token)
    .single()

  if (!student || !student.reset_token_expires) {
    return res.status(400).json({ error: 'Link đặt lại mật khẩu không hợp lệ' })
  }

  if (new Date(student.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Link đã hết hạn. Vui lòng yêu cầu lại.' })
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await supabase.from('students').update({
    password:             hashed,
    must_change_password: false,
    reset_token:          null,
    reset_token_expires:  null,
  }).eq('id', student.id)

  console.log(`✅ Đặt lại mật khẩu: ${student.email}`)
  return res.json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập.' })
})

/* ─── GET /api/auth/me ────────────────────────────────────────────────────── */
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    res.json(payload)
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' })
  }
})

module.exports = router
