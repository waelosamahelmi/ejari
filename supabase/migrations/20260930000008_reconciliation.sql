-- Monthly cash reconciliation explanations (cover summary "Explain" note, §6.8).
create table public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  period char(7) not null,
  owner_id uuid references public.owners(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users default auth.uid(),
  unique (org_id, period, owner_id)
);
alter table public.cash_reconciliations enable row level security;
create trigger set_updated_at before update on public.cash_reconciliations for each row execute function public.set_updated_at();
create policy recon_select on public.cash_reconciliations for select to authenticated
  using (public.has_role(org_id, array['admin','accountant','viewer']::public.member_role[]));
create policy recon_write on public.cash_reconciliations for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));
