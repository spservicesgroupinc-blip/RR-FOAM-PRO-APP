-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations (Optional multi-tenancy, effectively 'Company Settings')
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  settings jsonb default '{}'::jsonb,
  crew_pin text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Profiles (Extends Auth Users)
create table profiles (
  id uuid references auth.users not null primary key,
  organization_id uuid references organizations(id),
  role text check (role in ('admin', 'crew')) default 'crew',
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Customers
create table customers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id),
  name text not null,
  address text,
  city text,
  state text,
  zip text,
  email text,
  phone text,
  status text default 'Active',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Estimates
create table estimates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id),
  customer_id uuid references customers(id),
  status text default 'Draft', -- Draft, Work Order, Invoiced, Paid
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  materials jsonb default '{}'::jsonb,
  financials jsonb default '{}'::jsonb,
  settings_snapshot jsonb default '{}'::jsonb, -- Store snapshot of prices/settings at time of estimate
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Inventory Items
create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id),
  name text not null,
  quantity numeric default 0,
  unit text,
  unit_cost numeric default 0,
  category text, -- 'material', 'equipment'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Row Level Security)

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table estimates enable row level security;
alter table inventory_items enable row level security;

-- Policy: Admins can do everything for their org
create policy "Admins can do everything" on organizations
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = organizations.id
      and profiles.role = 'admin'
    )
  );

-- Policy: Users can view their own profile
create policy "Users can view own profile" on profiles
  for select using ( auth.uid() = id );

-- Policy: Admin read/write customers
create policy "Admins read/write customers" on customers
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = customers.organization_id
      and profiles.role = 'admin'
    )
  );

-- Policy: Crew read-only customers (for Work Orders)
create policy "Crew read customers" on customers
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = customers.organization_id
      and profiles.role = 'crew'
    )
  );
