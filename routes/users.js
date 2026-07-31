const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../lib/email');

const router = express.Router();

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function generateTempPassword() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const chars = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `VFS${digits}${chars}`; // VD: VFS7342AB
}

// Giá từng khoá (nghìn đồng) — khớp với routes/webhook.js
const COURSE_PRICES = { edit: 799, music: 299, plugin: 499 };

// Tổng tiền một học viên đã trả — cộng dồn từng khoá đã đăng ký.
// Học viên cũ chưa có courses (trước khi tính năng ra đời) mặc định tính Video Editing.
function studentRevenue(student) {
  const courses = Array.isArray(student.courses) && student.courses.length
    ? student.courses
    : ['edit'];
  return courses.reduce((sum, c) => sum + (COURSE_PRICES[c] || 0), 0);
}

/* ─── GET /api/users/stats — Thống kê tổng quan cho dashboard ────────────── */
router.get('/stats', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('paid, status, progress, courses');

  if (error) return res.status(500).json({ error: error.message });

  const paidStudents = data.filter((s) => s.paid);
  const revenue = paidStudents.reduce((sum, s) => sum + studentRevenue(s), 0);
  const avgProgress = data.length
    ? Math.round(data.reduce((sum, s) => sum + (s.progress || 0), 0) / data.length)
    : 0;

  res.json({
    total: data.length,
    paid: paidStudents.length,
    active: data.filter((s) => s.status === 'active').length,
    avgProgress,
    revenue, // nghìn đồng
  });
});

/* ─── GET /api/users ──────────────────────────────────────────────────────── */
router.get('/', requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const search = (req.query.search || '').trim();
  const status = req.query.status || '';

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('students')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      hasNext: page < Math.ceil(count / limit),
      hasPrev: page > 1,
    },
  });
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function capitalizeName(str = '') {
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/* ─── POST /api/users — Admin tạo tài khoản học viên ─────────────────────── */
router.post('/', requireAuth, async (req, res) => {
  const { email, phone, paid, status, courses } = req.body;
  const name = capitalizeName(req.body.name || '');
  if (!name || !email)
    return res.status(400).json({ error: 'Thiếu tên hoặc email' });

  const now = new Date();
  const joinDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // Sinh mật khẩu tạm + mã hoá
  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, 10);

  const { data, error } = await supabase
    .from('students')
    .insert({
      name,
      email,
      phone: phone || '',
      status: status || 'active',
      progress: 0,
      join_date: joinDate,
      paid: paid !== undefined ? paid : true,
      courses: Array.isArray(courses) ? courses : [],
      password: hashed,
      must_change_password: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505')
      return res.status(409).json({ error: 'Email đã tồn tại' });
    return res.status(500).json({ error: error.message });
  }

  // Gửi email tài khoản cho học viên
  try {
    await sendWelcomeEmail({ name, email, tempPassword, courses: data.courses?.length ? data.courses : ['edit'] });
    console.log(
      `✅ Tạo tài khoản & gửi email: ${email} | Mật khẩu tạm: ${tempPassword}`
    );
  } catch (emailErr) {
    console.error('⚠️  Gửi email thất bại:', emailErr.message);
    // Không fail request — tài khoản đã tạo, admin có thể gửi lại sau
  }

  res.status(201).json({ ...data, tempPassword }); // trả về tempPassword để admin biết
});

/* ─── POST /api/users/:id/resend-email — Gửi lại email ───────────────────── */
router.post('/:id/resend-email', requireAuth, async (req, res) => {
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!student)
    return res.status(404).json({ error: 'Không tìm thấy học viên' });

  // Sinh mật khẩu mới
  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, 10);

  await supabase
    .from('students')
    .update({
      password: hashed,
      must_change_password: true,
    })
    .eq('id', student.id);

  try {
    await sendWelcomeEmail({
      name: student.name,
      email: student.email,
      tempPassword,
      courses: student.courses?.length ? student.courses : ['edit'],
    });
    res.json({
      ok: true,
      message: `Email đã gửi lại tới ${student.email}`,
      tempPassword,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gửi email thất bại: ' + err.message });
  }
});

/* ─── PUT /api/users/:id ──────────────────────────────────────────────────── */
router.put('/:id', requireAuth, async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'status', 'progress', 'paid', 'courses'];
  const updates = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });
  if (updates.name) updates.name = capitalizeName(updates.name);

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ─── DELETE /api/users/:id ───────────────────────────────────────────────── */
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
