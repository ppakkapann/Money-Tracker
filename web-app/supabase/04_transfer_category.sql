-- Allow optional category_id on transfer transactions (deduct category budget).
-- Run in Supabase SQL Editor after 01_init.sql if transfers fail with check constraint errors.

begin;

alter table public.transactions drop constraint if exists tx_expense_income_requires_account;

alter table public.transactions add constraint tx_expense_income_requires_account check (
  (type in ('expense', 'income') and account_id is not null and from_account_id is null and to_account_id is null)
  or
  (
    type = 'transfer'
    and account_id is null
    and from_account_id is not null
    and to_account_id is not null
    and from_account_id <> to_account_id
  )
);

commit;
