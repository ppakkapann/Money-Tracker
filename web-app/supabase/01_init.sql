-- Money Tracker (Supabase) - schema, RLS, helper functions
-- Assumptions:
-- - Single user, but we still enable Supabase Auth + RLS.
-- - Seeded "defaults" may have user_id = NULL; app can read them and copy to the signed-in user.
-- - Month key stored as TEXT in 'YYYY-MM' format (e.g. '2026-04').

begin;

-- Extensions (safe if already enabled)
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type public.category_kind as enum ('expense', 'income');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_type as enum ('expense', 'income', 'transfer');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public.month_key(d date)
returns text
language sql
immutable
as $$
  select to_char(d, 'YYYY-MM');
$$;

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  currency text not null default 'THB',
  opening_balance numeric(14,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_name_user_unique unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text not null, -- hex like '#c084fc'
  kind public.category_kind not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_kind_user_unique unique (user_id, kind, name)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_month_category_user_unique unique (user_id, month, category_id),
  constraint budgets_month_format check (month ~ '^[0-9]{4}-[0-9]{2}$')
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  name text not null,
  note text,

  -- expense/income
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,

  -- transfer
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tx_expense_income_requires_account check (
    (type in ('expense','income') and account_id is not null and from_account_id is null and to_account_id is null)
    or
    (type = 'transfer' and account_id is null and category_id is null and from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id)
  )
);

create table if not exists public.bill_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  default_account_id uuid references public.accounts(id) on delete set null,
  default_due_day int not null check (default_due_day between 1 and 31),
  default_amount numeric(14,2) not null check (default_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bill_templates_name_user_unique unique (user_id, name)
);

create table if not exists public.bills_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  template_id uuid references public.bill_templates(id) on delete set null,
  name text not null,
  account_id uuid references public.accounts(id) on delete set null,
  due_date date,
  amount numeric(14,2) not null check (amount >= 0),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_monthly_user_month_template_unique unique (user_id, month, template_id)
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_transactions_user_date on public.transactions(user_id, date);
create index if not exists idx_transactions_user_account on public.transactions(user_id, account_id);
create index if not exists idx_transactions_user_from_to on public.transactions(user_id, from_account_id, to_account_id);
create index if not exists idx_budgets_user_month on public.budgets(user_id, month);
create index if not exists idx_bills_monthly_user_month on public.bills_monthly(user_id, month);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger trg_accounts_updated_at before update on public.accounts
  for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_categories_updated_at before update on public.categories
  for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_budgets_updated_at before update on public.budgets
  for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_transactions_updated_at before update on public.transactions
  for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_bill_templates_updated_at before update on public.bill_templates
  for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_bills_monthly_updated_at before update on public.bills_monthly
  for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.transactions enable row level security;
alter table public.bill_templates enable row level security;
alter table public.bills_monthly enable row level security;

-- "Defaults" rows (user_id is NULL) are readable by any authenticated user.
-- Users can read their own rows and can write only their own rows.

do $$ begin
  create policy accounts_select on public.accounts
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy accounts_insert on public.accounts
  for insert to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy accounts_update on public.accounts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy accounts_delete on public.accounts
  for delete to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy categories_select on public.categories
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy categories_insert on public.categories
  for insert to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy categories_update on public.categories
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy categories_delete on public.categories
  for delete to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy budgets_select on public.budgets
  for select to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy budgets_insert on public.budgets
  for insert to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy budgets_update on public.budgets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy budgets_delete on public.budgets
  for delete to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy transactions_select on public.transactions
  for select to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy transactions_update on public.transactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy transactions_delete on public.transactions
  for delete to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bill_templates_select on public.bill_templates
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bill_templates_insert on public.bill_templates
  for insert to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bill_templates_update on public.bill_templates
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bill_templates_delete on public.bill_templates
  for delete to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bills_monthly_select on public.bills_monthly
  for select to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bills_monthly_insert on public.bills_monthly
  for insert to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bills_monthly_update on public.bills_monthly
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy bills_monthly_delete on public.bills_monthly
  for delete to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- ============================================================
-- RPC: ensure monthly bills exist from templates
-- ============================================================
create or replace function public.ensure_bills_for_month(p_month text)
returns void
language plpgsql
security definer
as $$
begin
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid month format (expected YYYY-MM): %', p_month;
  end if;

  -- insert missing monthly rows from templates
  insert into public.bills_monthly (user_id, month, template_id, name, account_id, due_date, amount, paid)
  select
    auth.uid(),
    p_month,
    t.id,
    t.name,
    t.default_account_id,
    -- due date = month first day + (due_day-1), clamped by actual month end
    (
      to_date(p_month || '-01', 'YYYY-MM-DD')
      + (
        least(
          greatest(1, t.default_due_day),
          extract(
            day
            from (date_trunc('month', to_date(p_month || '-01', 'YYYY-MM-DD')) + interval '1 month - 1 day')
          )::int
        ) - 1
      )
    )::date,
    t.default_amount,
    false
  from public.bill_templates t
  where t.active = true
    and (t.user_id = auth.uid() or t.user_id is null)
    and not exists (
      select 1 from public.bills_monthly bm
      where bm.user_id = auth.uid()
        and bm.month = p_month
        and bm.template_id = t.id
    );
end;
$$;

revoke all on function public.ensure_bills_for_month(text) from public;
grant execute on function public.ensure_bills_for_month(text) to authenticated;

commit;

