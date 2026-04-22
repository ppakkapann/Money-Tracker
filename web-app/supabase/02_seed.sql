-- Money Tracker (Supabase) - seed defaults
-- Seeds are inserted with user_id = NULL so any signed-in user can read them,
-- and the app can copy/convert to the signed-in user's own rows later.

begin;

-- Accounts (defaults)
insert into public.accounts (user_id, name, currency, opening_balance)
values
  (null, 'Kasikorn', 'THB', 0),
  (null, 'Krungsri', 'THB', 0),
  (null, 'Krungthai', 'THB', 0),
  (null, 'Bangkok Bank', 'THB', 0),
  (null, 'Cash', 'THB', 0)
on conflict do nothing;

-- Categories (defaults) — muted palette order: Bills… → Others (see app EXPENSE_CATEGORY_ORDER)
insert into public.categories (user_id, name, color, kind)
values
  (null, 'Bills & Utilities', '#4A2E2E', 'expense'),
  (null, 'Food & Dining', '#3E4A2E', 'expense'),
  (null, 'Housing', '#2E374A', 'expense'),
  (null, 'Transportation', '#3D3D3D', 'expense'),
  (null, 'Shopping', '#4A432E', 'expense'),
  (null, 'Entertainment', '#4A2E3F', 'expense'),
  (null, 'Savings', '#2E414A', 'expense'),
  (null, 'Others', '#362E4A', 'expense'),
  (null, 'Salary', '#00CCCC', 'income')
on conflict do nothing;

-- Bill templates (defaults)
-- Note: default_account_id left null for defaults; the app should map this
-- to the user's selected account (e.g. Kasikorn) after onboarding.
insert into public.bill_templates (user_id, name, default_account_id, default_due_day, default_amount, active)
values
  (null, 'Insurance Alianz', null, 1, 1847.00, true),
  (null, 'Water (Muve 22)', null, 22, 80.00, true),
  (null, 'Water (Minburi)', null, 1, 368.00, true),
  (null, 'AIS Internet', null, 2, 533.93, true),
  (null, 'Electricity (Muve)', null, 3, 190.00, true),
  (null, 'Electricity (Min)', null, 3, 10.00, true),
  (null, 'Youtube', null, 6, 60.00, true),
  (null, 'Spotify', null, 26, 70.00, true),
  (null, 'Dtac Phone', null, 30, 961.93, true),
  (null, 'icloud', null, 31, 0.00, true)
on conflict do nothing;

-- Budget defaults for the current month are not seeded for a specific user,
-- because budgets are user-scoped. The app should create budgets for the
-- signed-in user by copying these defaults on first run.
-- If you want to manually seed a user, do it in SQL Editor after you know the user_id.

commit;

