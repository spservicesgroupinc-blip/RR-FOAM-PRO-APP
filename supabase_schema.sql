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

-- Documents (tracks all generated PDFs per org/customer/estimate)
create table documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  customer_id uuid references customers(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  document_type text not null check (document_type in ('estimate', 'invoice', 'receipt', 'work_order', 'purchase_order')),
  filename text not null,
  storage_path text not null,
  public_url text,
  file_size integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_documents_org on documents(organization_id);
create index idx_documents_customer on documents(customer_id);
create index idx_documents_estimate on documents(estimate_id);
create index idx_documents_type on documents(document_type);
create index idx_documents_created on documents(created_at desc);

alter table documents enable row level security;

create policy "Admins full access to documents" on documents
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = documents.organization_id
      and profiles.role = 'admin'
    )
  );

create policy "Crew read documents" on documents
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = documents.organization_id
      and profiles.role = 'crew'
    )
  );

-- RPC: Get all documents for a customer (SECURITY DEFINER for crew access)
create or replace function get_customer_documents(p_org_id uuid, p_customer_id uuid)
returns setof documents
language sql
security definer
as $$
  select * from documents
  where organization_id = p_org_id
    and customer_id = p_customer_id
  order by created_at desc;
$$;

-- RPC: Get all documents for an estimate
create or replace function get_estimate_documents(p_org_id uuid, p_estimate_id uuid)
returns setof documents
language sql
security definer
as $$
  select * from documents
  where organization_id = p_org_id
    and estimate_id = p_estimate_id
  order by created_at desc;
$$;

-- ============================================
-- EQUIPMENT MAINTENANCE TABLES
-- ============================================

-- Equipment registry
create table maintenance_equipment (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  description text,
  category text default 'general',
  total_sets_sprayed numeric default 0,
  total_hours_operated numeric default 0,
  lifetime_sets numeric default 0,
  lifetime_hours numeric default 0,
  status text default 'active' check (status in ('active', 'inactive', 'retired')),
  last_service_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Service items per equipment (admin-configurable)
create table maintenance_service_items (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid references maintenance_equipment(id) on delete cascade not null,
  organization_id uuid references organizations(id) not null,
  name text not null,
  description text,
  interval_sets numeric default 0,
  interval_hours numeric default 0,
  sets_since_last_service numeric default 0,
  hours_since_last_service numeric default 0,
  last_serviced_at timestamp with time zone,
  last_serviced_by text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Service log history
create table maintenance_service_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  equipment_id uuid references maintenance_equipment(id) on delete cascade not null,
  service_item_id uuid references maintenance_service_items(id) on delete set null,
  service_date timestamp with time zone default timezone('utc'::text, now()) not null,
  performed_by text,
  notes text,
  sets_at_service numeric default 0,
  hours_at_service numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Job usage linking (tracks material sprayed per job)
create table maintenance_job_usage (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  estimate_id uuid references estimates(id) on delete set null,
  open_cell_sets numeric default 0,
  closed_cell_sets numeric default 0,
  total_sets numeric generated always as (open_cell_sets + closed_cell_sets) stored,
  operating_hours numeric default 0,
  job_date timestamp with time zone default timezone('utc'::text, now()),
  customer_name text,
  notes text,
  applied boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
