begin;

-- A schedule version must be rebuildable on its own: after a prepayment it starts from a
-- balance that can't be derived from the loan row, and it must point at the payment that
-- created it so that prepayment can be undone precisely.
alter table public.schedule_versions
  add column opening_principal numeric(14,2) check (opening_principal >= 0),
  add column payment_id uuid references public.payments(id) on delete restrict;

create unique index schedule_versions_payment_id_idx
  on public.schedule_versions(payment_id) where payment_id is not null;

update public.schedule_versions as versions
set opening_principal = loans.total_financed_amount
from public.loans
where loans.id = versions.loan_id
  and versions.schedule_type = 'original'
  and versions.opening_principal is null;

-- Records a part-prepayment and its revised schedule in one transaction, so a failure can
-- never leave a loan without a current schedule. Runs as the caller: RLS still applies.
create function public.record_prepayment(
  p_loan_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_balance_before numeric,
  p_annual_rate numeric,
  p_new_emi numeric,
  p_new_tenure_months integer,
  p_installments jsonb,
  p_transaction_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_version_id uuid;
  v_next_version integer;
  v_first_emi_date date;
begin
  select regular_emi_start_date into v_first_emi_date
  from public.loans
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'Loan was not found or is not accessible.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Prepayment amount must be greater than zero.';
  end if;

  if p_amount >= p_balance_before then
    raise exception 'Prepayment must be less than the outstanding balance.';
  end if;

  if p_payment_date > current_date then
    raise exception 'Prepayment date cannot be in the future.';
  end if;

  if v_first_emi_date is not null and p_payment_date < v_first_emi_date then
    raise exception 'Prepayments can be recorded from the first EMI date onwards.';
  end if;

  if exists (
    select 1 from public.schedule_versions
    where loan_id = p_loan_id and is_current and effective_date > p_payment_date
  ) then
    raise exception 'Prepayment date must be on or after your latest schedule revision.';
  end if;

  if p_new_tenure_months <= 0 or jsonb_array_length(p_installments) <> p_new_tenure_months then
    raise exception 'Revised schedule is incomplete.';
  end if;

  insert into public.payments (
    loan_id, payment_date, amount, payment_type, principal_component, interest_component,
    transaction_reference, notes
  ) values (
    p_loan_id, p_payment_date, p_amount, 'part_prepayment', p_amount, 0,
    nullif(trim(p_transaction_reference), ''), nullif(trim(p_notes), '')
  )
  returning id into v_payment_id;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.schedule_versions
  where loan_id = p_loan_id;

  update public.schedule_versions
  set is_current = false
  where loan_id = p_loan_id and is_current;

  insert into public.schedule_versions (
    loan_id, version_number, schedule_type, effective_date, annual_interest_rate, emi_amount,
    remaining_tenure_months, opening_principal, payment_id, is_current, notes
  ) values (
    p_loan_id, v_next_version, 'projected', p_payment_date, p_annual_rate, p_new_emi,
    p_new_tenure_months, p_balance_before - p_amount, v_payment_id, true,
    'Revised after a part-prepayment.'
  )
  returning id into v_version_id;

  insert into public.installments (
    schedule_version_id, installment_number, installment_type, due_date, scheduled_amount,
    opening_balance, principal_amount, interest_amount, closing_balance
  )
  select
    v_version_id,
    (item->>'installment_number')::integer,
    'regular_emi',
    (item->>'due_date')::date,
    (item->>'scheduled_amount')::numeric,
    (item->>'opening_balance')::numeric,
    (item->>'principal_amount')::numeric,
    (item->>'interest_amount')::numeric,
    (item->>'closing_balance')::numeric
  from jsonb_array_elements(p_installments) as item;

  return v_payment_id;
end;
$$;

-- Undoes the most recent prepayment: removes its schedule version (and installments), makes the
-- previous version current again, then removes the payment. Only the latest can be undone, so
-- later revisions are never left pointing at a schedule that no longer exists.
create function public.delete_prepayment(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_loan_id uuid;
  v_version_id uuid;
  v_is_current boolean;
begin
  select loan_id into v_loan_id
  from public.payments
  where id = p_payment_id and payment_type = 'part_prepayment';

  if not found then
    raise exception 'Prepayment was not found or is not accessible.';
  end if;

  perform 1 from public.loans where id = v_loan_id for update;

  select id, is_current into v_version_id, v_is_current
  from public.schedule_versions
  where payment_id = p_payment_id;

  if v_version_id is not null then
    if not v_is_current then
      raise exception 'Undo later prepayments first.';
    end if;

    delete from public.schedule_versions where id = v_version_id;

    update public.schedule_versions
    set is_current = true
    where id = (
      select id from public.schedule_versions
      where loan_id = v_loan_id
      order by version_number desc
      limit 1
    );
  end if;

  delete from public.payments where id = p_payment_id;
end;
$$;

revoke all on function public.record_prepayment(uuid, date, numeric, numeric, numeric, numeric, integer, jsonb, text, text) from public, anon;
revoke all on function public.delete_prepayment(uuid) from public, anon;
grant execute on function public.record_prepayment(uuid, date, numeric, numeric, numeric, numeric, integer, jsonb, text, text) to authenticated;
grant execute on function public.delete_prepayment(uuid) to authenticated;

commit;
