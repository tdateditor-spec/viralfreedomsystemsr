const nodemailer = require('nodemailer')

/* ─── Transporter ─────────────────────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // email gửi: vd admin@gmail.com
    pass: process.env.GMAIL_PASS,   // App Password (không phải mật khẩu Gmail)
  },
})

const SITE_URL = process.env.SITE_URL || 'https://your-domain.com'
const COURSE   = 'VIRAL FREEDOM SYSTEM'

/* ─── Template: Gửi tài khoản mới ────────────────────────────────────────── */
async function sendWelcomeEmail({ name, email, tempPassword }) {
  const loginUrl = `${SITE_URL}/login`

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Tài khoản ${COURSE}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#141520;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:36px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.6);text-transform:uppercase;">Chào mừng đến với</p>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">VIRAL FREEDOM SYSTEM</h1>
      <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">90-Day Video Editing Challenge</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#e2e8f0;line-height:1.6;">
        Xin chào <strong style="color:#ffffff;">${name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
        Thanh toán của bạn đã được xác nhận thành công! 🎉<br/>
        Dưới đây là thông tin đăng nhập vào khoá học:
      </p>

      <!-- Credentials box -->
      <div style="background:#0f1117;border:1px solid rgba(59,130,246,0.3);border-radius:14px;padding:24px;margin-bottom:28px;">
        <div style="margin-bottom:16px;">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Email đăng nhập</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#60a5fa;">${email}</p>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Mật khẩu tạm thời</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:2px;font-family:monospace;">${tempPassword}</p>
        </div>
      </div>

      <!-- Warning -->
      <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:10px;padding:14px 18px;margin-bottom:28px;">
        <p style="margin:0;font-size:13px;color:#fbbf24;line-height:1.6;">
          ⚠️ <strong>Quan trọng:</strong> Bạn sẽ được yêu cầu đổi mật khẩu sau khi đăng nhập lần đầu.
        </p>
      </div>

      <!-- CTA button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${loginUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:12px;box-shadow:0 0 24px rgba(59,130,246,0.4);">
          Đăng nhập ngay →
        </a>
      </div>

      <!-- What's next -->
      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#e2e8f0;">Bạn sẽ được học:</p>
        <ul style="margin:0;padding-left:20px;color:#64748b;font-size:13px;line-height:2;">
          <li>Chapter 1: Mindset — Tư duy freelancer quốc tế</li>
          <li>Chapter 2: Skill — Video Editing chuyên nghiệp</li>
          <li>Chapter 3: Sales — Tìm client & chốt deal</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0f1117;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#334155;">
        Cần hỗ trợ? Nhắn Telegram
        <a href="https://t.me/viralfreedom" style="color:#60a5fa;text-decoration:none;">@viralfreedom</a>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#1e293b;">© 2025 Viral Freedom System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `

  await transporter.sendMail({
    from: `"Viral Freedom System" <${process.env.GMAIL_USER}>`,
    to:   email,
    subject: `🎉 Tài khoản khoá học ${COURSE} của bạn`,
    html,
  })

  console.log(`✅ Welcome email sent → ${email}`)
}

module.exports = { sendWelcomeEmail }
