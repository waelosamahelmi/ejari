-- Ijari: tables. Money = bigint fils. Every row carries org_id for RLS.

-- ---------------------------------------------------------------- organization
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text,
  logo_path text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  display_name text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (org_id, user_id)
);
create index on public.org_members (user_id);

-- ---------------------------------------------------------------- owners & properties
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  full_name text not null,
  civil_id text,
  phones text[] not null default '{}',
  email text,
  iban text,
  bank_name text,
  address text,
  notes text,
  portal_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.owners (org_id);
create index on public.owners (portal_user_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  name_en text,
  area text,
  block text,
  street text,
  avenue text,
  house_or_plot text,
  paci_no text check (paci_no is null or paci_no ~ '^\d{8}$'),
  property_type public.property_type not null default 'residential',
  floors int,
  notes text,
  cover_image_path text,
  photos jsonb not null default '[]'::jsonb,
  default_residential_template_id uuid,
  default_investment_template_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.properties (org_id);

create table public.property_owners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.owners(id),
  share_pct numeric(5,2) not null default 100 check (share_pct > 0 and share_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (property_id, owner_id)
);
create index on public.property_owners (owner_id);
create index on public.property_owners (org_id);

create table public.property_commissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  kind public.commission_kind not null,
  value numeric(14,3) not null check (value >= 0),
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.property_commissions (property_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  type public.unit_type not null default 'apartment',
  floor int,
  area_m2 numeric(10,2),
  bedrooms int,
  bathrooms int,
  paci_no text check (paci_no is null or paci_no ~ '^\d{8}$'),
  asking_rent_fils bigint not null default 0 check (asking_rent_fils >= 0),
  elec_meter_no text,
  water_meter_no text,
  notes text,
  photos jsonb not null default '[]'::jsonb,
  under_maintenance boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (property_id, label)
);
create index on public.units (org_id);
create index on public.units (property_id, sort_order);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  full_name text not null,
  civil_id text,
  nationality text,
  phones text[] not null default '{}',
  email text,
  employer text,
  emergency_contact text,
  notes text,
  blacklisted boolean not null default false,
  blacklist_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.tenants (org_id);
create index on public.tenants (org_id, civil_id);

-- ---------------------------------------------------------------- templates
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade, -- null = system template
  type public.contract_type not null,
  name text not null,
  version int not null default 1,
  family_id uuid not null default gen_random_uuid(), -- all versions of one template share a family
  preamble text not null,
  closing text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.contract_templates (org_id, type);

create table public.template_clauses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  template_id uuid not null references public.contract_templates(id) on delete cascade,
  position int not null,
  key text not null,
  body text not null,
  condition text,
  default_condition text,
  optional boolean not null default false,
  default_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (template_id, key)
);
create index on public.template_clauses (template_id, position);

-- ---------------------------------------------------------------- contracts
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_no text not null,
  type public.contract_type not null,
  template_id uuid references public.contract_templates(id),
  tenant_id uuid not null references public.tenants(id),
  property_id uuid not null references public.properties(id),
  owner_id uuid references public.owners(id),
  contract_date date not null,
  start_date date not null,
  first_collection_date date not null,
  term_months int not null default 60 check (term_months > 0),
  end_date date not null,
  auto_renew boolean not null default false,
  renewal_term_months int,
  monthly_rent_fils bigint not null check (monthly_rent_fils >= 0),
  purpose text not null default '',
  utilities_party public.utilities_party not null default 'owner',
  electricity_fixed_fils bigint not null default 0 check (electricity_fixed_fils >= 0),
  free_months int not null default 0 check (free_months >= 0),
  free_months_penalty_window_months int not null default 12,
  notice_period_months int not null default 2,
  security_deposit_fils bigint not null default 0 check (security_deposit_fils >= 0),
  deposit_status public.deposit_status not null default 'none',
  annual_increase_kind public.increase_kind,
  annual_increase_value numeric(14,3),
  annual_increase_every_months int,
  status public.contract_status not null default 'draft',
  notice_date date,
  expected_move_out date,
  move_out_date date,
  termination_reason text,
  renewed_from_id uuid references public.contracts(id),
  clause_overrides jsonb not null default '{}'::jsonb,
  custom_clauses jsonb not null default '[]'::jsonb,
  rendered_clauses jsonb,
  signed_file_path text,
  notes text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (org_id, contract_no),
  check (first_collection_date >= start_date),
  check (end_date >= start_date)
);
create index on public.contracts (org_id, status);
create index on public.contracts (tenant_id);
create index on public.contracts (property_id);

create table public.contract_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  unit_id uuid not null references public.units(id),
  rent_share_fils bigint check (rent_share_fils is null or rent_share_fils >= 0),
  -- denormalized from contracts (trigger) so the exclusion constraint can see them
  occupancy daterange not null default 'empty',
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (contract_id, unit_id),
  constraint contract_units_no_overlap exclude using gist (unit_id with =, occupancy with &&) where (is_live)
);
create index on public.contract_units (unit_id);

create table public.contract_rent_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  effective_from date not null,
  monthly_rent_fils bigint not null check (monthly_rent_fils >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.contract_rent_revisions (contract_id);

-- ---------------------------------------------------------------- billing
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  unit_id uuid references public.units(id),
  period char(7) not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind public.charge_kind not null,
  amount_fils bigint not null check (amount_fils >= 0),
  waived_value_fils bigint not null default 0 check (waived_value_fils >= 0),
  due_date date not null,
  description text,
  voided boolean not null default false,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create unique index charges_scheduled_unique on public.charges (contract_id, period, kind)
  where kind in ('rent', 'free', 'electricity_fixed') and not voided;
create index on public.charges (org_id, period);
create index on public.charges (contract_id, period);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  contract_id uuid not null references public.contracts(id),
  amount_fils bigint not null check (amount_fils > 0),
  method public.payment_method not null default 'cash',
  received_at date not null,
  receipt_no text,
  system_no text,
  reference text,
  collected_by uuid references auth.users(id),
  notes text,
  attachment_path text,
  client_id uuid unique,
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.payments (org_id, received_at);
create index on public.payments (contract_id);
create index on public.payments (org_id, receipt_no);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  charge_id uuid not null references public.charges(id) on delete cascade,
  amount_fils bigint not null check (amount_fils > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.payment_allocations (payment_id);
create index on public.payment_allocations (charge_id);

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  charge_id uuid references public.charges(id),
  kind public.adjustment_kind not null,
  amount_fils bigint not null check (amount_fils > 0),
  adjustment_date date not null default current_date,
  reason text not null check (length(trim(reason)) > 0),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.adjustments (contract_id);

-- ---------------------------------------------------------------- expenses
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  type public.expense_category_type not null default 'operating',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.expense_categories (org_id);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  kind public.beneficiary_kind not null default 'other',
  phone text,
  monthly_salary_fils bigint check (monthly_salary_fils is null or monthly_salary_fils >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.beneficiaries (org_id);

create table public.expense_vouchers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  voucher_no text not null,
  voucher_date date not null,
  paid_from public.paid_from not null default 'cash_box',
  reference text,
  recipient_name text,
  notes text,
  status public.voucher_status not null default 'draft',
  void_reason text,
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (org_id, voucher_no)
);
create index on public.expense_vouchers (org_id, voucher_date);

create table public.expense_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  voucher_id uuid not null references public.expense_vouchers(id) on delete cascade,
  position int not null default 1,
  amount_fils bigint not null check (amount_fils > 0),
  category_id uuid not null references public.expense_categories(id),
  beneficiary_id uuid references public.beneficiaries(id),
  description text not null default '',
  allocation_mode public.allocation_mode not null default 'single',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.expense_lines (voucher_id);

create table public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  expense_line_id uuid not null references public.expense_lines(id) on delete cascade,
  property_id uuid not null references public.properties(id),
  unit_id uuid references public.units(id),
  amount_fils bigint not null check (amount_fils >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.expense_allocations (expense_line_id);
create index on public.expense_allocations (property_id);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  beneficiary_id uuid references public.beneficiaries(id),
  amount_fils bigint not null check (amount_fils > 0),
  description text not null default '',
  allocation jsonb not null default '{"mode":"single","targets":[]}'::jsonb,
  day_of_month int not null default 25 check (day_of_month between 1 and 28),
  last_generated_period char(7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);

-- ---------------------------------------------------------------- deposits & closings
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deposit_date date not null,
  amount_fils bigint not null check (amount_fils > 0),
  destination public.deposit_destination not null,
  owner_id uuid references public.owners(id),
  bank_name text,
  reference text,
  notes text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.deposits (org_id, deposit_date);

create table public.deposit_properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deposit_id uuid not null references public.deposits(id) on delete cascade,
  property_id uuid not null references public.properties(id),
  amount_fils bigint not null check (amount_fils >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.deposit_properties (deposit_id);

create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  period char(7) not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) default auth.uid(),
  notes text,
  cash_difference_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (org_id, period)
);

-- ---------------------------------------------------------------- legal
create table public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  contract_id uuid references public.contracts(id),
  tenant_id uuid not null references public.tenants(id),
  case_no text,
  court text,
  type public.legal_case_type not null default 'rent_claim',
  status public.legal_status not null default 'filed',
  amount_claimed_fils bigint not null default 0 check (amount_claimed_fils >= 0),
  next_hearing_date date,
  lawyer text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.legal_cases (org_id, status);
create index on public.legal_cases (contract_id);

create table public.legal_case_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  case_id uuid not null references public.legal_cases(id) on delete cascade,
  event_date date not null,
  title text not null,
  notes text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.legal_case_events (case_id);

-- ---------------------------------------------------------------- system
create table public.reminders_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  channel public.reminder_channel not null default 'whatsapp',
  message text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.reminders_log (tenant_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  bucket text not null default 'documents',
  path text not null,
  file_name text not null,
  mime text,
  size bigint,
  uploaded_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.attachments (entity_type, entity_id);

create table public.number_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  key text not null,
  year int not null,
  last_value int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (org_id, key, year)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index on public.audit_log (org_id, at desc);
create index on public.audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------- notifications (§19.7)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  locale text not null default 'ar',
  last_used_at timestamptz,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.push_subscriptions (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title_ar text not null,
  title_en text not null,
  body_ar text not null,
  body_en text not null,
  url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  dismissed_at timestamptz,
  pushed_at timestamptz,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid()
);
create index on public.notifications (user_id, created_at desc);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  push boolean not null default true,
  in_app boolean not null default true,
  email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (user_id, type)
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete set null,
  locale text not null default 'ar',
  theme text not null default 'system',
  accent text not null default 'ink',
  digits text not null default 'latn',
  density text not null default 'comfortable',
  quiet_start time not null default '22:00',
  quiet_end time not null default '08:00',
  digest_time time not null default '09:00',
  muted_property_ids uuid[] not null default '{}',
  dashboard_layout jsonb,
  install_prompt_dismissed_at timestamptz,
  onboarding_done boolean not null default false,
  sessions_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
