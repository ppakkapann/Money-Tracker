-- Money Tracker (Supabase) - seed defaults
-- Seeds are inserted with user_id = NULL so any signed-in user can read them,
-- and the app can copy/convert to the signed-in user's own rows later.

begin;

-- Accounts (defaults)
-- Accounts are NOT seeded. Users add accounts themselves.

-- Categories (8 templates) - no budgets are seeded
insert into public.categories (user_id, name, color, kind, archived)
values
  (null, 'Bills & Utilities', '#E64B5D', 'expense', false),
  (null, 'Food & Dining',     '#FF8A3D', 'expense', false),
  (null, 'Housing',           '#4E6BFF', 'expense', false),
  (null, 'Transportation',    '#60A5FA', 'expense', false),
  (null, 'Shopping',          '#F2C94C', 'expense', false),
  (null, 'Entertainment',     '#A855F7', 'expense', false),
  (null, 'Savings',           '#2DD4BF', 'expense', false),
  (null, 'Other',             '#22C55E', 'expense', false)
on conflict do nothing;

-- Bill templates: intentionally not seeded (no templates)

-- Budget defaults for the current month are not seeded for a specific user,
-- because budgets are user-scoped. The app should create budgets for the
-- signed-in user by copying these defaults on first run.
-- If you want to manually seed a user, do it in SQL Editor after you know the user_id.

commit;

