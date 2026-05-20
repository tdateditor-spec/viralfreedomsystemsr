const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'vfs-secret-key-2025'

function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' })
  }
  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' })
  }
}

module.exports = { requireAuth, JWT_SECRET }
