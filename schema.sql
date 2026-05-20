-- ============================================================
-- VIRAL FREEDOM SYSTEM — Database Schema
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- 1. Admin
create table if not exists admin_users (
  id          serial primary key,
  email       text unique not null,
  password    text not null,        -- bcrypt hash
  name        text not null default 'Admin',
  role        text not null default 'admin',
  created_at  timestamptz default now()
);

-- 2. Chapters (Chương)
create table if not exists chapters (
  id          text primary key,     -- e.g. "C1"
  "order"     int not null,
  title       text not null,
  description text default '',
  created_at  timestamptz default now()
);

-- 3. Lessons (Bài học)
create table if not exists lessons (
  id          text primary key,     -- e.g. "L1"
  chapter_id  text references chapters(id) on delete cascade,
  "order"     int not null,
  title       text not null,
  duration    text default '00:00',
  free        boolean default false,
  video_url   text default '',
  created_at  timestamptz default now()
);

-- 4. Students (Học viên)
create table if not exists students (
  id                   serial primary key,
  name                 text not null,
  email                text unique not null,
  phone                text default '',
  password             text default '',             -- bcrypt hash (temp password)
  must_change_password boolean default true,        -- bắt đổi mật khẩu lần đầu
  status               text default 'pending',      -- active | inactive | pending
  progress             int default 0,              -- 0-100
  join_date            text default '',
  paid                 boolean default false,
  created_at           timestamptz default now()
);

-- Migration: thêm cột nếu bảng đã tồn tại
alter table students add column if not exists password text default '';
alter table students add column if not exists must_change_password boolean default true;

-- ============================================================
-- Seed data — Admin mặc định (mật khẩu: admin123)
-- ============================================================
insert into admin_users (email, password, name, role)
values (
  'admin@viralfreedom.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Admin',
  'admin'
) on conflict (email) do nothing;

-- ============================================================
-- Seed data — Chapters & Lessons
-- ============================================================
insert into chapters (id, "order", title, description) values
  ('C1', 1, 'Chapter 1: Mindset', 'Xây dựng tư duy freelancer quốc tế'),
  ('C2', 2, 'Chapter 2: Skill',   'Kỹ năng video editing chuyên nghiệp'),
  ('C3', 3, 'Chapter 3: Sales',   'Hệ thống tìm client và chốt deal')
on conflict (id) do nothing;

insert into lessons (id, chapter_id, "order", title, duration, free, video_url) values
  ('L1',  'C1', 1, 'Chào mừng & Lộ trình 90 ngày',              '12:30', true,  ''),
  ('L2',  'C1', 2, 'Reset tư duy, tại sao kỹ năng không đủ',    '18:45', false, ''),
  ('L3',  'C1', 3, 'Cách thị trường freelance vận hành',          '22:10', false, ''),
  ('L4',  'C1', 4, 'Xác định mục tiêu $1,000 đầu tiên',          '15:20', false, ''),
  ('L5',  'C1', 5, 'Mindset của người kiếm tiền vs người học',   '19:55', false, ''),
  ('L6',  'C2', 1, 'Premiere Pro từ A đến Z (Workflow)',          '35:00', false, ''),
  ('L7',  'C2', 2, 'Cut, trim & cấu trúc video chuẩn',           '28:15', false, ''),
  ('L8',  'C2', 3, 'Color grading cho video quốc tế',             '31:40', false, ''),
  ('L9',  'C2', 4, 'Sound design & music sync',                   '24:30', false, ''),
  ('L10', 'C2', 5, 'After Effects: motion graphics cơ bản',      '42:00', false, ''),
  ('L11', 'C2', 6, 'Xây dựng 3 video mẫu portfolio',              '55:20', false, ''),
  ('L12', 'C3', 1, 'Xây portfolio Instagram thu hút client',      '26:10', false, ''),
  ('L13', 'C3', 2, '10 Template Cold DM tiếng Anh',               '33:45', false, ''),
  ('L14', 'C3', 3, 'Phân tích profile, nhận diện khách tiềm năng','21:00', false, ''),
  ('L15', 'C3', 4, 'Đàm phán & báo giá không bị ép giá',         '29:30', false, ''),
  ('L16', 'C3', 5, 'Giữ client dài hạn & upsell',                 '18:20', false, '')
on conflict (id) do nothing;

-- ============================================================
-- Seed data — Học viên mẫu
-- ============================================================
insert into students (name, email, phone, status, progress, join_date, paid) values
  ('Nguyễn Minh Anh', 'minhanh@gmail.com', '0901 234 567', 'active',   75,  '12/03/2025', true),
  ('Trần Văn Kiên',   'kien@gmail.com',    '0912 345 678', 'active',   30,  '18/03/2025', true),
  ('Lê Thị Hoa',      'hoa@gmail.com',     '0923 456 789', 'inactive', 10,  '25/03/2025', true),
  ('Phạm Quốc Bảo',   'bao@gmail.com',     '0934 567 890', 'active',   100, '01/04/2025', true),
  ('Hoàng Thu Trang', 'trang@gmail.com',   '0945 678 901', 'pending',  0,   '05/05/2025', false)
on conflict (email) do nothing;
