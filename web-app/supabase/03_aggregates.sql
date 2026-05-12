-- Money Tracker (Supabase) - aggregate RPCs for scalability
--
-- Apply once in the Supabase SQL editor (after 01_init.sql / 02_seed.sql).
-- This adds a server-side aggregate so the web app no longer needs to
-- download every transaction just to compute account balances. The app
-- continues to load only the visible month window of raw transactions.

begin;

-- Returns one row per account (only accounts that have any activity).
-- balance_delta is the net change applied by all of the caller's transactions
--   up to and including p_cutoff (or all-time when p_cutoff is null):
--     +amount on income, -amount on expense for the owning account
--     +amount on transfer destination, -amount on transfer source
-- last_change is the latest date among those same transactions.
create or replace function public.account_balances_as_of(p_cutoff date default null)
returns table (account_id uuid, balance_delta numeric, last_change date)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with my_tx as (
    select *
    from public.transactions
    where user_id = auth.uid()
      and (p_cutoff is null or date <= p_cutoff)
  ),
  income_expense as (
    select
      account_id,
      sum(case when type = 'income' then amount
               when type = 'expense' then -amount
               else 0 end) as delta,
      max(date) as last_date
    from my_tx
    where account_id is not null
      and type in ('income', 'expense')
    group by account_id
  ),
  transfer_in as (
    select to_account_id as account_id, sum(amount) as delta, max(date) as last_date
    from my_tx
    where type = 'transfer' and to_account_id is not null
    group by to_account_id
  ),
  transfer_out as (
    select from_account_id as account_id, -sum(amount) as delta, max(date) as last_date
    from my_tx
    where type = 'transfer' and from_account_id is not null
    group by from_account_id
  ),
  unified as (
    select * from income_expense
    union all select * from transfer_in
    union all select * from transfer_out
  )
  select
    account_id,
    coalesce(sum(delta), 0)::numeric as balance_delta,
    max(last_date) as last_change
  from unified
  where account_id is not null
  group by account_id;
$$;

revoke all on function public.account_balances_as_of(date) from public;
grant execute on function public.account_balances_as_of(date) to authenticated;

commit;
