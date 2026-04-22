-- ============================================================
--  MONEY TRACKER 2026 — Supabase SQL Schema
--  วาง SQL นี้ใน Supabase → SQL Editor → New Query → Run
-- ============================================================

-- Enable UUID extension (มักเปิดอยู่แล้วใน Supabase)
create extension if not exists "uuid-ossp";


-- ============================================================
-- 1. ACCOUNTS — บัญชีธนาคาร / เงินสด
-- ============================================================
create table if not exists accounts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,                     -- เช่น "Kasikorn", "Cash"
  type        text not null default 'bank',      -- 'bank' | 'cash' | 'credit' | 'savings'
  balance     numeric(12, 2) not null default 0,
  currency    text not null default 'THB',
  color       text,                              -- hex color สำหรับ UI
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- ============================================================
-- 2. CATEGORIES — หมวดหมู่รายจ่าย/รายรับ
-- ============================================================
create table if not exists categories (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null,                    -- เช่น "Food & Dining"
  type         text not null default 'expense',  -- 'expense' | 'income'
  color        text,                             -- hex color
  icon         text,                             -- emoji หรือ icon name
  monthly_budget  numeric(12, 2) default 0,      -- งบประมาณต่อเดือน
  is_active    boolean not null default true,
  created_at   timestamptz default now()
);


-- ============================================================
-- 3. EXPENSES — รายจ่าย
-- ============================================================
create table if not exists expenses (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  category_id  uuid references categories(id) on delete set null,
  name         text not null,                    -- ชื่อรายการ
  amount       numeric(12, 2) not null,
  date         date not null default current_date,
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);


-- ============================================================
-- 4. INCOME — รายรับ
-- ============================================================
create table if not exists income (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  category_id  uuid references categories(id) on delete set null,
  name         text not null,                    -- เช่น "Salary", "Freelance"
  amount       numeric(12, 2) not null,
  date         date not null default current_date,
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);


-- ============================================================
-- 5. TRANSFERS — โอนระหว่างบัญชี
-- ============================================================
create table if not exists transfers (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade,
  from_account_id  uuid references accounts(id) on delete set null,
  to_account_id    uuid references accounts(id) on delete set null,
  name             text,                         -- หมายเหตุการโอน
  amount           numeric(12, 2) not null,
  date             date not null default current_date,
  note             text,
  created_at       timestamptz default now()
);


-- ============================================================
-- 6. BILLS — บิลรายเดือน (recurring)
-- ============================================================
create table if not exists bills (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  name         text not null,                    -- เช่น "AIS Internet"
  amount       numeric(12, 2) not null,
  due_day      int not null check (due_day between 1 and 31), -- วันที่ครบกำหนดในเดือน
  category_id  uuid references categories(id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz default now()
);


-- ============================================================
-- 7. BILL_PAYMENTS — บันทึกการจ่ายบิลแต่ละเดือน
-- ============================================================
create table if not exists bill_payments (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade,
  bill_id    uuid references bills(id) on delete cascade,
  year       int not null,
  month      int not null check (month between 1 and 12),
  amount     numeric(12, 2) not null,            -- อาจต่างจาก bill.amount ได้ (เช่น ค่าน้ำแต่ละเดือนไม่เท่ากัน)
  paid       boolean not null default false,
  paid_at    timestamptz,
  created_at timestamptz default now(),
  unique (bill_id, year, month)                  -- 1 บิล ต่อ 1 เดือน
);


-- ============================================================
-- 8. SAVINGS_GOALS — เป้าหมายออมเงิน
-- ============================================================
create table if not exists savings_goals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  account_id    uuid references accounts(id) on delete set null,  -- บัญชีที่ linked
  name          text not null,
  target_amount numeric(12, 2) not null,
  current_amount numeric(12, 2) not null default 0,
  target_date   date,
  is_completed  boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);


-- ============================================================
-- 9. MONTHLY_SALARY — เงินเดือนแต่ละเดือน (ใช้คำนวณ % budget)
-- ============================================================
create table if not exists monthly_salary (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade,
  year       int not null,
  month      int not null check (month between 1 and 12),
  amount     numeric(12, 2) not null,
  created_at timestamptz default now(),
  unique (user_id, year, month)
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS) — ผู้ใช้เห็นแค่ข้อมูลตัวเอง
-- ============================================================

alter table accounts        enable row level security;
alter table categories      enable row level security;
alter table expenses        enable row level security;
alter table income          enable row level security;
alter table transfers       enable row level security;
alter table bills           enable row level security;
alter table bill_payments   enable row level security;
alter table savings_goals   enable row level security;
alter table monthly_salary  enable row level security;

-- Policies: อ่าน/เขียน/แก้ไข/ลบ เฉพาะของตัวเอง
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts','categories','expenses','income',
    'transfers','bills','bill_payments','savings_goals','monthly_salary'
  ] loop
    execute format('
      create policy "%s_policy" on %I
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    ', t, t);
  end loop;
end $$;


-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- v_monthly_spending — ยอดใช้จ่ายรายเดือนต่อหมวด
create or replace view v_monthly_spending as
select
  e.user_id,
  extract(year  from e.date)::int as year,
  extract(month from e.date)::int as month,
  c.id   as category_id,
  c.name as category_name,
  c.monthly_budget,
  sum(e.amount) as total_spent,
  c.monthly_budget - sum(e.amount) as remaining
from expenses e
left join categories c on c.id = e.category_id
group by e.user_id, year, month, c.id, c.name, c.monthly_budget;


-- v_account_balances — ยอดรวมต่อบัญชี (เผื่อคำนวณในอนาคต)
create or replace view v_account_balances as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.balance,
  a.currency
from accounts a
where a.is_active = true;


-- v_bill_status — สถานะบิลเดือนปัจจุบัน
create or replace view v_bill_status as
select
  b.id as bill_id,
  b.user_id,
  b.name,
  b.amount       as default_amount,
  b.due_day,
  bp.year,
  bp.month,
  coalesce(bp.amount, b.amount) as actual_amount,
  coalesce(bp.paid, false)      as paid,
  bp.paid_at
from bills b
left join bill_payments bp
  on bp.bill_id = b.bill_id and bp.year = extract(year from now()) and bp.month = extract(month from now())
where b.is_active = true;


-- ============================================================
-- SEED DATA — ข้อมูลตัวอย่าง (ลบออกได้ก่อน deploy จริง)
-- แทนที่ 'YOUR-USER-ID' ด้วย UUID จาก Supabase → Auth → Users
-- ============================================================

/*
-- ตัวอย่าง: insert บัญชี
insert into accounts (user_id, name, type, balance) values
  ('YOUR-USER-ID', 'Kasikorn',     'bank',    9646.97),
  ('YOUR-USER-ID', 'Krungsri',     'savings', 36186.89),
  ('YOUR-USER-ID', 'Krungthai',    'bank',    26295.41),
  ('YOUR-USER-ID', 'Bangkok Bank', 'bank',    3700.00),
  ('YOUR-USER-ID', 'Cash',         'cash',    3700.00);

-- ตัวอย่าง: insert หมวดหมู่
insert into categories (user_id, name, type, monthly_budget, color) values
  ('YOUR-USER-ID', 'Shopping',      'expense', 5000,  '#c084fc'),
  ('YOUR-USER-ID', 'Entertainment', 'expense', 2000,  '#fbbf24'),
  ('YOUR-USER-ID', 'Bills & Utils', 'expense', 6600,  '#818cf8'),
  ('YOUR-USER-ID', 'Transport',     'expense', 800,   '#34d399'),
  ('YOUR-USER-ID', 'Food & Dining', 'expense', 7000,  '#00CCCC'),
  ('YOUR-USER-ID', 'Housing',       'expense', 4000,  '#f472b6'),
  ('YOUR-USER-ID', 'Savings',       'expense', 10000, '#2dd4bf'),
  ('YOUR-USER-ID', 'Others',        'expense', 3600,  '#6b7280'),
  ('YOUR-USER-ID', 'Salary',        'income',  0,     '#00CCCC');
*/
