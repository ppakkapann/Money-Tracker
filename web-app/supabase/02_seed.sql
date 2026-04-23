-- Money Tracker (Supabase) - seed defaults
-- Seeds are inserted with user_id = NULL so any signed-in user can read them,
-- and the app can copy/convert to the signed-in user's own rows later.

begin;

-- Accounts (defaults)
-- Accounts are NOT seeded. Users add accounts themselves.

-- Categories (8 templates) - no budgets are seeded
insert into public.categories (user_id, name, color, kind, archived)
values
  (null, 'Bills & Utilities', '#c77d86', 'expense', false),
  (null, 'Food & Dining',     '#8aa37b', 'expense', false),
  (null, 'Housing',           '#6b7ea8', 'expense', false),
  (null, 'Transportation',    '#a7a7a7', 'expense', false),
  (null, 'Shopping',          '#b59b63', 'expense', false),
  (null, 'Entertainment',     '#b06a86', 'expense', false),
  (null, 'Savings',           '#6b98a3', 'expense', false),
  (null, 'Others',            '#8a77a6', 'expense', false)
on conflict do nothing;

-- Bill templates: intentionally not seeded (no templates)

-- Budget defaults for the current month are not seeded for a specific user,
-- because budgets are user-scoped. The app should create budgets for the
-- signed-in user by copying these defaults on first run.
-- If you want to manually seed a user, do it in SQL Editor after you know the user_id.

commit;

