const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

const SITE_URL     = process.env.SITE_URL || 'https://getviralfreedomsystem.com'
const TELEGRAM_URL = 'https://t.me/+jWnmBTQuQ8VkMGY1'

// Link Drive cho từng khoá — thay bằng link thật khi có
const DRIVE_LINKS = {
  edit:   process.env.DRIVE_EDIT   || 'https://drive.google.com/drive/folders/FAKE_VIDEO_EDITING_FOLDER',
  music:  process.env.DRIVE_MUSIC  || 'https://drive.google.com/drive/folders/FAKE_SOUND_DESIGN_FOLDER',
  plugin: process.env.DRIVE_PLUGIN || 'https://drive.google.com/drive/folders/FAKE_PLUGIN_FOLDER',
}

async function sendWelcomeEmail({ name, email, tempPassword, courses = ['edit'] }) {
  const loginUrl = `${SITE_URL}/login`

  // Build danh sách tài nguyên Drive theo khoá đã mua
  const courseItems = [
    { key: 'edit',   label: 'VIRAL FREEDOM SYSTEM – Video Editing', icon: '🎬' },
    { key: 'music',  label: 'Sound Design & Premium Background Music', icon: '🎵' },
    { key: 'plugin', label: 'Atom Plugin & Premium Presets Collection', icon: '⚡' },
  ].filter(c => courses.includes(c.key))

  const driveSection = courseItems.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <p style="margin:0;font-size:13px;color:#e2e8f0;">${c.icon} ${c.label}</p>
      </div>
      <a href="${DRIVE_LINKS[c.key]}"
        style="flex-shrink:0;margin-left:12px;display:inline-block;background:#1e40af;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:7px 16px;border-radius:8px;">
        Truy cập →
      </a>
    </div>
  `).join('')

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
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
      <p style="margin:0 0 8px;font-size:15px;color:#e2e8f0;line-height:1.6;">
        Xin chào <strong style="color:#ffffff;">${name}</strong> 👋
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.7;">
        Thanh toán của bạn đã được xác nhận! Dưới đây là tất cả thông tin bạn cần để bắt đầu.
      </p>

      <!-- Step 1: Tài khoản -->
      <div style="margin-bottom:20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;">① Đăng nhập khoá học</p>
        <div style="background:#0f1117;border:1px solid rgba(59,130,246,0.3);border-radius:14px;padding:20px;">
          <div style="margin-bottom:14px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Email</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#60a5fa;">${email}</p>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Mật khẩu tạm thời</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:3px;font-family:monospace;">${tempPassword}</p>
          </div>
        </div>
        <div style="margin-top:8px;padding:10px 14px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:8px;">
          <p style="margin:0;font-size:12px;color:#fbbf24;">⚠️ Đổi mật khẩu sau khi đăng nhập lần đầu</p>
        </div>
      </div>

      <!-- Step 2: Tài nguyên Drive -->
      <div style="margin-bottom:20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:1px;">② Tài nguyên khoá học của bạn</p>
        <div style="background:#0f1117;border:1px solid rgba(52,211,153,0.25);border-radius:14px;padding:16px 20px;">
          ${driveSection}
          <p style="margin:12px 0 0;font-size:11px;color:#475569;">Nhấn "Truy cập →" để mở thư mục Google Drive tương ứng.</p>
        </div>
      </div>

      <!-- Step 3: Telegram -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;">③ Tham gia cộng đồng Telegram</p>
        <div style="background:#0f1117;border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:14px;color:#e2e8f0;">Viral Freedom System — Cộng Đồng</p>
          <p style="margin:0 0 16px;font-size:12px;color:#64748b;">Hỗ trợ 24/7 · Chia sẻ bài tập · Network</p>
          <a href="${TELEGRAM_URL}"
            style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;">
            Vào nhóm Telegram →
          </a>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${loginUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 48px;border-radius:12px;box-shadow:0 0 24px rgba(59,130,246,0.35);">
          Vào học ngay →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0f1117;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#334155;">© 2025 Viral Freedom System · <a href="${SITE_URL}" style="color:#60a5fa;text-decoration:none;">getviralfreedomsystem.com</a></p>
    </div>
  </div>
</body>
</html>
  `

  await transporter.sendMail({
    from:    `"Viral Freedom System" <${process.env.GMAIL_USER}>`,
    to:      email,
    subject: `🎉 Thanh toán thành công — Tài khoản & nhóm Telegram của bạn`,
    html,
  })

  console.log(`✅ Welcome email sent → ${email}`)
}

async function sendResetPasswordEmail({ name, email, token }) {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#141520;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:36px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.6);text-transform:uppercase;">Đặt lại mật khẩu</p>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">VIRAL FREEDOM SYSTEM</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;">Xin chào <strong style="color:#ffffff;">${name}</strong> 👋</p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.<br/>
        Nhấn nút bên dưới để tạo mật khẩu mới — link có hiệu lực trong <strong style="color:#fbbf24;">1 giờ</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 48px;border-radius:12px;box-shadow:0 0 24px rgba(59,130,246,0.35);">
          Đặt lại mật khẩu →
        </a>
      </div>
      <div style="padding:14px 18px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:10px;margin-bottom:8px;">
        <p style="margin:0;font-size:12px;color:#fbbf24;">⚠️ Nếu bạn không yêu cầu điều này, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>
      </div>
      <p style="margin:16px 0 0;font-size:11px;color:#475569;word-break:break-all;">
        Hoặc dán link vào trình duyệt: <span style="color:#60a5fa;">${resetUrl}</span>
      </p>
    </div>
    <div style="background:#0f1117;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#334155;">© 2025 Viral Freedom System · <a href="${SITE_URL}" style="color:#60a5fa;text-decoration:none;">getviralfreedomsystem.com</a></p>
    </div>
  </div>
</body>
</html>`

  await transporter.sendMail({
    from:    `"Viral Freedom System" <${process.env.GMAIL_USER}>`,
    to:      email,
    subject: `🔐 Đặt lại mật khẩu — Viral Freedom System`,
    html,
  })
}

module.exports = { sendWelcomeEmail, sendResetPasswordEmail }
