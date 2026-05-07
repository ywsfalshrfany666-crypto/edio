create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone_e164 text,
  shipping_address jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  payment_method text not null default 'cod',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  phone_e164 text not null,
  secondary_phone_e164 text,
  province text not null,
  province_ar text,
  region text not null,
  nearest_point text not null,
  full_address text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  edio_order_id text not null,
  provider_order_id text,
  provider_tracking_id text,
  status text not null default 'not_sent',
  dry_run boolean not null default true,
  request_summary jsonb not null default '{}'::jsonb,
  response_summary jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, edio_order_id)
);

create table if not exists public.shipping_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'alwaseet',
  edio_order_id text,
  shipping_integration_id uuid references public.shipping_integrations(id) on delete cascade,
  event_type text not null,
  status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists customer_addresses_customer_id_idx on public.customer_addresses(customer_id);
create index if not exists shipping_integrations_order_idx on public.shipping_integrations(provider, edio_order_id);
create index if not exists shipping_events_order_idx on public.shipping_events(edio_order_id, created_at desc);
create index if not exists shipping_events_type_created_idx on public.shipping_events(event_type, created_at desc);

alter table public.orders enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.shipping_integrations enable row level security;
alter table public.shipping_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'Customers can read their own orders') then
    create policy "Customers can read their own orders"
      on public.orders for select
      using (auth.uid() = customer_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customer_addresses' and policyname = 'Customers can manage their own addresses') then
    create policy "Customers can manage their own addresses"
      on public.customer_addresses for all
      using (auth.uid() = customer_id)
      with check (auth.uid() = customer_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_integrations' and policyname = 'No direct customer access to shipping integrations') then
    create policy "No direct customer access to shipping integrations"
      on public.shipping_integrations for select
      using (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_events' and policyname = 'No direct customer access to shipping events') then
    create policy "No direct customer access to shipping events"
      on public.shipping_events for select
      using (false);
  end if;
end $$;
