begin;

create extension if not exists pgcrypto;

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lender_name text not null,
  loan_reference_masked text,
  sanctioned_principal numeric(14,2) not null check (sanctioned_principal > 0),
  insurance_amount numeric(14,2) not null default 0 check (insurance_amount >= 0),
  total_financed_amount numeric(14,2) generated always as (sanctioned_principal + insurance_amount) stored,
  currency text not null default 'INR',
  interest_type text not null check (interest_type in ('floating', 'fixed', 'hybrid')),
  benchmark_name text,
  benchmark_spread_percent numeric(7,4) check (benchmark_spread_percent between -100 and 100),
  current_interest_rate numeric(7,4) not null check (current_interest_rate between 0 and 100),
  regular_emi_amount numeric(14,2) not null check (regular_emi_amount > 0),
  first_installment_amount numeric(14,2) check (first_installment_amount >= 0),
  first_installment_date date,
  regular_emi_start_date date,
  original_tenure_months integer not null check (original_tenure_months > 0),
  property_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  category text not null check (category in (
    'sanction_letter', 'disbursement_letter', 'loan_statement',
    'interest_certificate', 'payment_receipt', 'rate_revision_letter', 'other'
  )),
  file_name text not null,
  storage_bucket text not null default 'loan-documents',
  storage_path text not null unique,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes >= 0),
  statement_period_start date,
  statement_period_end date,
  uploaded_at timestamptz not null default now()
);

create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  schedule_type text not null check (schedule_type in (
    'original', 'lender_revised', 'projected', 'prepayment_simulation'
  )),
  effective_date date not null,
  annual_interest_rate numeric(7,4) not null check (annual_interest_rate between 0 and 100),
  emi_amount numeric(14,2) not null check (emi_amount >= 0),
  remaining_tenure_months integer not null check (remaining_tenure_months >= 0),
  source_document_id uuid references public.documents(id) on delete set null,
  is_current boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (loan_id, version_number)
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  schedule_version_id uuid not null references public.schedule_versions(id) on delete cascade,
  installment_number integer not null check (installment_number >= 0),
  installment_type text not null check (installment_type in (
    'first_installment', 'regular_emi', 'balloon', 'adjustment'
  )),
  due_date date not null,
  opening_balance numeric(14,2) check (opening_balance >= 0),
  scheduled_amount numeric(14,2) not null check (scheduled_amount >= 0),
  principal_amount numeric(14,2) check (principal_amount >= 0),
  interest_amount numeric(14,2) check (interest_amount >= 0),
  closing_balance numeric(14,2) check (closing_balance >= 0),
  created_at timestamptz not null default now(),
  unique (schedule_version_id, installment_number)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete set null,
  receipt_document_id uuid references public.documents(id) on delete set null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_type text not null check (payment_type in (
    'first_installment', 'emi', 'part_prepayment', 'foreclosure',
    'fee', 'penalty', 'insurance', 'refund', 'other'
  )),
  principal_component numeric(14,2) check (principal_component >= 0),
  interest_component numeric(14,2) check (interest_component >= 0),
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.rate_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  effective_date date not null,
  rbi_repo_rate numeric(7,4) check (rbi_repo_rate between 0 and 100),
  lender_benchmark_rate numeric(7,4) check (lender_benchmark_rate between 0 and 100),
  benchmark_spread_percent numeric(7,4) check (benchmark_spread_percent between -100 and 100),
  expected_loan_rate numeric(7,4) check (expected_loan_rate between 0 and 100),
  actual_applied_rate numeric(7,4) check (actual_applied_rate between 0 and 100),
  advertised_starting_rate numeric(7,4) check (advertised_starting_rate between 0 and 100),
  source_url text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index loans_owner_id_idx on public.loans(owner_id);
create index documents_loan_id_idx on public.documents(loan_id);
create index schedule_versions_loan_id_idx on public.schedule_versions(loan_id);
create index schedule_versions_effective_date_idx on public.schedule_versions(effective_date);
create unique index schedule_versions_one_current_per_loan_idx
  on public.schedule_versions(loan_id) where is_current = true;
create index installments_schedule_version_id_idx on public.installments(schedule_version_id);
create index installments_due_date_idx on public.installments(due_date);
create index payments_loan_id_idx on public.payments(loan_id);
create index payments_payment_date_idx on public.payments(payment_date);
create index rate_events_loan_id_idx on public.rate_events(loan_id);
create index rate_events_effective_date_idx on public.rate_events(effective_date);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger loans_set_updated_at
before update on public.loans
for each row execute function public.set_updated_at();

alter table public.loans enable row level security;
alter table public.documents enable row level security;
alter table public.schedule_versions enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.rate_events enable row level security;

revoke all on public.loans, public.documents, public.schedule_versions,
  public.installments, public.payments, public.rate_events from anon;

grant select, insert, update, delete on public.loans, public.documents,
  public.schedule_versions, public.installments, public.payments,
  public.rate_events to authenticated;

create policy "Users manage own loans"
on public.loans for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Users manage own documents"
on public.documents for all to authenticated
using (exists (
  select 1 from public.loans
  where loans.id = documents.loan_id and loans.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.loans
  where loans.id = documents.loan_id and loans.owner_id = (select auth.uid())
));

create policy "Users manage own schedules"
on public.schedule_versions for all to authenticated
using (exists (
  select 1 from public.loans
  where loans.id = schedule_versions.loan_id and loans.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.loans
  where loans.id = schedule_versions.loan_id and loans.owner_id = (select auth.uid())
));

create policy "Users manage own installments"
on public.installments for all to authenticated
using (exists (
  select 1
  from public.schedule_versions
  join public.loans on loans.id = schedule_versions.loan_id
  where schedule_versions.id = installments.schedule_version_id
    and loans.owner_id = (select auth.uid())
))
with check (exists (
  select 1
  from public.schedule_versions
  join public.loans on loans.id = schedule_versions.loan_id
  where schedule_versions.id = installments.schedule_version_id
    and loans.owner_id = (select auth.uid())
));

create policy "Users manage own payments"
on public.payments for all to authenticated
using (exists (
  select 1 from public.loans
  where loans.id = payments.loan_id and loans.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.loans
  where loans.id = payments.loan_id and loans.owner_id = (select auth.uid())
));

create policy "Users manage own rate events"
on public.rate_events for all to authenticated
using (exists (
  select 1 from public.loans
  where loans.id = rate_events.loan_id and loans.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.loans
  where loans.id = rate_events.loan_id and loans.owner_id = (select auth.uid())
));

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'loan-documents',
  'loan-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
);

create policy "Users read own loan files"
on storage.objects for select to authenticated
using (
  bucket_id = 'loan-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users upload own loan files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'loan-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users update own loan files"
on storage.objects for update to authenticated
using (
  bucket_id = 'loan-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'loan-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete own loan files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'loan-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
