const express  = require('express')
const crypto   = require('crypto')
const bcrypt   = require('bcryptjs')
const supabase = require('../db')
const { sendWelcomeEmail } = require('../lib/email')

const router = express.Router()

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

// Xác minh chữ ký HMAC từ SePay
function verifySignature(payload, signature) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  if (!secret) return true // bỏ qua nếu chưa cấu hình
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch { return false }
}

// Trích số điện thoại từ nội dung "VFS 0901234567"
function extractPhone(content = '') {
  const match = content.match(/VFS\s*(\d{9,11})/i)
  return match ? match[1] : null
}

/* ─── POST /api/webhook/sepay ─────────────────────────────────────────────── */
router.post('/sepay', async (req, res) => {
  try {
    // req.body đã được parse bởi express.json() global middleware
    // req.rawBody là raw string được lưu bởi verify callback trong index.js
    const body = req.body

    // 1. Xác minh chữ ký HMAC
    // SePay gửi header: x-sepay-signature: sha256=<hex>
    const sigHeader = req.headers['x-sepay-signature']
    if (sigHeader) {
      const secret = process.env.SEPAY_WEBHOOK_SECRET
      if (secret) {
        const rawBody = req.rawBody || JSON.stringify(body)
        const expected    = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
        // SePay format: "sha256=<hex>" — strip prefix nếu có
        const sigHex      = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader
        if (sigHex.toLowerCase() !== expected.toLowerCase()) {
          console.warn('⚠️  Webhook: invalid signature — processing anyway (verify secret matches SePay dashboard)')
        }
      }
    }

    // SePay format: transferAmount, transferType, content/description
    const transferType   = body.transferType   || body.transfer_type
    const transferAmount = body.transferAmount || body.transfer_amount || body.amount
    const content        = body.content        || body.description     || body.transferContent || ''
    const customerEmail  = body.customerEmail  || body.customer_email  || ''
    const event          = body.event          || ''

    console.log('📩 Webhook SePay:', JSON.stringify(body, null, 2))

    // 2. Chỉ xử lý tiền vào (transferType = 'in')
    // Nếu SePay gửi event field thì check thêm
    if (transferType && transferType !== 'in') {
      return res.json({ received: true, skipped: 'not_incoming' })
    }
    if (event && event !== 'payment.success' && event !== 'payment_success') {
      return res.json({ received: true, skipped: 'not_success_event' })
    }

    // 3. Kiểm tra số tiền
    if (Number(transferAmount) < 799000) {
      console.warn(`⚠️  Số tiền không đủ: ${transferAmount}`)
      return res.json({ received: true, skipped: 'amount_insufficient' })
    }

    // 4. Tìm học viên theo email hoặc SĐT trong nội dung CK
    let student = null

    if (customerEmail) {
      const { data } = await supabase
        .from('students').select('*').eq('email', customerEmail).single()
      student = data
    }

    if (!student && content) {
      const phone = extractPhone(content)
      if (phone) {
        const { data } = await supabase
          .from('students').select('*').ilike('phone', `%${phone}%`).single()
        student = data
      }
    }

    // 5. Tạo tài khoản + gửi email tự động
    if (student) {
      if (student.paid) {
        console.log('ℹ️  Đã thanh toán trước đó:', student.email)
        return res.json({ received: true, skipped: 'already_paid' })
      }

      const now      = new Date()
      const joinDate = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`

      // Sinh mật khẩu tạm
      const digits      = Math.floor(1000 + Math.random() * 9000)
      const chars       = Math.random().toString(36).slice(2, 4).toUpperCase()
      const tempPassword = `VFS${digits}${chars}`
      const hashed      = await bcrypt.hash(tempPassword, 10)

      await supabase.from('students').update({
        paid:                 true,
        status:               'active',
        join_date:            joinDate,
        password:             hashed,
        must_change_password: true,
      }).eq('id', student.id)

      console.log(`✅ Kích hoạt tài khoản: ${student.email} | Mật khẩu tạm: ${tempPassword}`)

      // Gửi email chào mừng + thông tin đăng nhập
      try {
        await sendWelcomeEmail({ name: student.name, email: student.email, tempPassword })
        console.log(`📧 Đã gửi email tới: ${student.email}`)
      } catch (emailErr) {
        console.error('⚠️  Gửi email thất bại:', emailErr.message)
      }
    } else {
      console.warn('⚠️  Không tìm thấy học viên:', { customerEmail, content })
    }

    // 6. Gửi Telegram notification (nếu đã cấu hình)
    await notifyTelegram(req.body, student)

    return res.json({ received: true })

  } catch (err) {
    console.error('❌ Webhook error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/* ─── Telegram notification (tuỳ chọn) ───────────────────────────────────── */
async function notifyTelegram(payload, student) {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return // chưa cấu hình → bỏ qua

  const name    = student?.name  || 'Chưa xác định'
  const email   = student?.email || payload.customerEmail || payload.customer_email || '—'
  const phone   = student?.phone || '—'
  const amount  = Number(payload.transferAmount || payload.amount || 0).toLocaleString('vi-VN')
  const content = payload.content || payload.description || payload.transferContent || '—'

  const msg = [
    `💰 *THANH TOÁN MỚI*`,
    ``,
    `👤 Học viên: ${name}`,
    `📧 Email: ${email}`,
    `📱 SĐT: ${phone}`,
    `💵 Số tiền: ${amount}đ`,
    `📝 Nội dung: ${content}`,
    ``,
    `👉 Vào /admin để tạo tài khoản cho học viên`,
  ].join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
    })
    console.log('📱 Telegram notified')
  } catch (e) {
    console.error('⚠️  Telegram notify failed:', e.message)
  }
}

module.exports = router
