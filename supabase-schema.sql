-- StockPilot Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create stocks table
create table stocks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  industry text default '',
  tier text default 'mid' check (tier in ('high', 'mid', 'low')),
  eps numeric,
  pe_high numeric,
  pe_mid numeric,
  pe_low numeric,
  condition_price_1 numeric,
  condition_price_2 numeric,
  status text default 'watching' check (status in ('watching', 'holding', 'cleared')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Create trades table
create table trades (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid references stocks(id) on delete cascade,
  type text not null check (type in ('buy', 'sell', 'adjust', 'dividend')),
  trade_date date not null,
  price numeric not null,
  quantity integer not null,
  notes text default '',
  created_at timestamptz default now()
);

-- 3. Create settings table
create table settings (
  id uuid primary key default gen_random_uuid(),
  cash_balance numeric default 0,
  updated_at timestamptz default now()
);

-- 4. RLS policies (allow all for anon - single user app)
create policy "Allow all on stocks" on stocks for all using (true) with check (true);
create policy "Allow all on trades" on trades for all using (true) with check (true);
create policy "Allow all on settings" on settings for all using (true) with check (true);

-- 5. Insert default settings row
insert into settings (cash_balance) values (0);
