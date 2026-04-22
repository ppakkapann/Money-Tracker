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

-- Categories: intentionally not seeded (no templates)

-- Bill templates: intentionally not seeded (no templates)

-- Budget defaults for the current month are not seeded for a specific user,
-- because budgets are user-scoped. The app should create budgets for the
-- signed-in user by copying these defaults on first run.
-- If you want to manually seed a user, do it in SQL Editor after you know the user_id.

commit;

