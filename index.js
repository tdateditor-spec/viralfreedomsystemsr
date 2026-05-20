require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const authRoutes    = require('./routes/auth')
const courseRoutes  = require('./routes/courses')
const userRoutes    = require('./routes/users')
const webhookRoutes = require('./routes/webhook')

const app = express()

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3001',
    'http://localhost:4173',
    'https://landing-v2-three-lyart.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true,
}))
app.use(express.json())

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/users',   userRoutes)
app.use('/api/webhook', webhookRoutes)

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// ── Local dev: listen on port ────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000
  app.listen(PORT, () => {
    console.log(`\n🚀 VFS Server running on http://localhost:${PORT}`)
    console.log(`   Health:  http://localhost:${PORT}/api/health`)
    console.log(`   Webhook: http://localhost:${PORT}/api/webhook/sepay\n`)
  })
}

// ── Export for Vercel serverless ─────────────────────────────────────────────
module.exports = app
