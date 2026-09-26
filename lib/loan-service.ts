import { supabase } from "@/lib/supabase/client";

export type LoanRow = {
  id: string;
  lender_name: string;
  loan_reference_masked: string | null;
  sanctioned_principal: number;
  insurance_amount: number;
  total_financed_amount: number;
  current_interest_rate: number;
  regular_emi_amount: number;
  first_installment_amount: number | null;
  first_installment_date: string | null;
  regular_emi_start_date: string | null;
  original_tenure_months: number;
  interest_type: "floating" | "fixed" | "hybrid";
  benchmark_name: string | null;
  benchmark_spread_percent: number | null;
  property_reference: string | null;
  notes: string | null;
  created_at: string;
};

type InstallmentRow = {
  id: string;
  installment_number: number;
  installment_type: string;
  due_date: string;
  scheduled_amount: number;
};

export type RateEventRow = {
  rbi_repo_rate: number | null;
  lender_benchmark_rate: number | null;
  expected_loan_rate: number | null;
  actual_applied_rate: number | null;
  verified_at: string | null;
  source_url: string | null;
};

type PaymentRow = {
  amount: number;
  payment_date: string;
  principal_component: number | null;
};

export type DashboardData = {
  loan: LoanRow;
  installments: InstallmentRow[];
  latestRate: RateEventRow | null;
  previousRate: RateEventRow | null;
  payments: PaymentRow[];
};

export type LoanSetupInput = {
  lenderName: string;
  loanReference: string;
  sanctionedPrincipal: number;
  insuranceAmount: number;
  interestType: "floating" | "fixed" | "hybrid";
  benchmarkName: string;
  benchmarkSpreadPercent: number | null;
  currentInterestRate: number;
  regularEmiAmount: number;
  firstInstallmentAmount: number | null;
  firstInstallmentDate: string;
  regularEmiStartDate: string;
  originalTenureMonths: number;
  rateEffectiveDate: string;
  rbiRepoRate: number | null;
  lenderBenchmarkRate: number | null;
  rateSourceUrl: string;
};

function addMonthsIso(isoDate: string, monthsToAdd: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const targetMonth = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const result = new Date(targetYear, normalizedMonth, Math.min(day, lastDay));
  return [
    result.getFullYear(),
    String(result.getMonth() + 1).padStart(2, "0"),
    String(result.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function createLoanProfile(userId: string, input: LoanSetupInput) {
  const createdLoan = await supabase
    .from("loans")
    .insert({
      owner_id: userId,
      lender_name: input.lenderName,
      loan_reference_masked: input.loanReference || null,
      sanctioned_principal: input.sanctionedPrincipal,
      insurance_amount: input.insuranceAmount,
      interest_type: input.interestType,
      benchmark_name: input.benchmarkName || null,
      benchmark_spread_percent: input.benchmarkSpreadPercent,
      current_interest_rate: input.currentInterestRate,
      regular_emi_amount: input.regularEmiAmount,
      first_installment_amount: input.firstInstallmentAmount,
      first_installment_date: input.firstInstallmentDate || null,
      regular_emi_start_date: input.regularEmiStartDate,
      original_tenure_months: input.originalTenureMonths,
    })
    .select("id")
    .single();

  if (createdLoan.error) throw createdLoan.error;
  const loanId = createdLoan.data.id;

  try {
    const createdSchedule = await supabase
      .from("schedule_versions")
      .insert({
        loan_id: loanId,
        version_number: 1,
        schedule_type: "original",
        effective_date: input.firstInstallmentDate || input.regularEmiStartDate,
        annual_interest_rate: input.currentInterestRate,
        emi_amount: input.regularEmiAmount,
        remaining_tenure_months: input.originalTenureMonths,
        is_current: true,
      })
      .select("id")
      .single();

    if (createdSchedule.error) throw createdSchedule.error;

    const installments = Array.from(
      { length: input.originalTenureMonths },
      (_, index) => ({
        schedule_version_id: createdSchedule.data.id,
        installment_number: index + 1,
        installment_type: "regular_emi",
        due_date: addMonthsIso(input.regularEmiStartDate, index),
        scheduled_amount: input.regularEmiAmount,
      }),
    );

    if (input.firstInstallmentAmount !== null && input.firstInstallmentDate) {
      installments.unshift({
        schedule_version_id: createdSchedule.data.id,
        installment_number: 0,
        installment_type: "first_installment",
        due_date: input.firstInstallmentDate,
        scheduled_amount: input.firstInstallmentAmount,
      });
    }

    const installmentsResult = await supabase.from("installments").insert(installments);
    if (installmentsResult.error) throw installmentsResult.error;

    const hasRateSnapshot =
      input.rbiRepoRate !== null ||
      input.lenderBenchmarkRate !== null ||
      Boolean(input.rateSourceUrl);

    if (hasRateSnapshot) {
      const expectedRate =
        input.lenderBenchmarkRate !== null && input.benchmarkSpreadPercent !== null
          ? input.lenderBenchmarkRate + input.benchmarkSpreadPercent
          : null;

      const rateResult = await supabase.from("rate_events").insert({
        loan_id: loanId,
        effective_date: input.rateEffectiveDate || input.regularEmiStartDate,
        rbi_repo_rate: input.rbiRepoRate,
        lender_benchmark_rate: input.lenderBenchmarkRate,
        benchmark_spread_percent: input.benchmarkSpreadPercent,
        expected_loan_rate: expectedRate,
        actual_applied_rate: input.currentInterestRate,
        source_url: input.rateSourceUrl || null,
      });

      if (rateResult.error) throw rateResult.error;
    }
  } catch (error) {
    await supabase.from("loans").delete().eq("id", loanId);
    throw error;
  }
}

export async function loadDashboardData(userId: string): Promise<DashboardData | null> {
  const loanResult = await supabase
    .from("loans")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (loanResult.error) throw loanResult.error;
  if (!loanResult.data) return null;

  const loan = loanResult.data as LoanRow;
  const [installmentsResult, ratesResult, paymentsResult] = await Promise.all([
    supabase
      .from("installments")
      .select(
        "id, installment_number, installment_type, due_date, scheduled_amount, schedule_versions!inner(loan_id)",
      )
      .eq("schedule_versions.loan_id", loan.id)
      .order("due_date", { ascending: true }),
    supabase
      .from("rate_events")
      .select(
        "rbi_repo_rate, lender_benchmark_rate, expected_loan_rate, actual_applied_rate, verified_at, source_url",
      )
      .eq("loan_id", loan.id)
      .order("created_at", { ascending: false })
      .limit(2),
    supabase
      .from("payments")
      .select("amount, payment_date, principal_component")
      .eq("loan_id", loan.id)
      .order("payment_date", { ascending: false }),
  ]);

  if (installmentsResult.error) throw installmentsResult.error;
  if (ratesResult.error) throw ratesResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  return {
    loan,
    installments: (installmentsResult.data ?? []) as unknown as InstallmentRow[],
    latestRate: (ratesResult.data?.[0] ?? null) as RateEventRow | null,
    previousRate: (ratesResult.data?.[1] ?? null) as RateEventRow | null,
    payments: (paymentsResult.data ?? []) as PaymentRow[],
  };
}

export type RateHistoryRow = RateEventRow & {
  id: string;
  effective_date: string;
  notes: string | null;
  created_at: string;
};

export type ProfileData = {
  loan: LoanRow;
  rateHistory: RateHistoryRow[];
};

export type LoanDetailsInput = {
  lenderName: string;
  loanReference: string;
  sanctionedPrincipal: number;
  insuranceAmount: number;
  interestType: "floating" | "fixed" | "hybrid";
  benchmarkName: string;
  benchmarkSpreadPercent: number | null;
  propertyReference: string;
  notes: string;
};

export type RateRevisionInput = {
  newRate: number;
  effectiveDate: string;
  note: string;
};

const rateHistoryColumns =
  "id, effective_date, rbi_repo_rate, lender_benchmark_rate, expected_loan_rate, actual_applied_rate, verified_at, source_url, notes, created_at";

export async function loadProfileData(userId: string): Promise<ProfileData | null> {
  const loanResult = await supabase
    .from("loans")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (loanResult.error) throw loanResult.error;
  if (!loanResult.data) return null;

  const loan = loanResult.data as LoanRow;
  const historyResult = await supabase
    .from("rate_events")
    .select(rateHistoryColumns)
    .eq("loan_id", loan.id)
    .order("created_at", { ascending: false });

  if (historyResult.error) throw historyResult.error;

  return { loan, rateHistory: (historyResult.data ?? []) as RateHistoryRow[] };
}

export async function updateLoanDetails(loan: LoanRow, input: LoanDetailsInput) {
  const result = await supabase
    .from("loans")
    .update({
      lender_name: input.lenderName,
      loan_reference_masked: input.loanReference || null,
      sanctioned_principal: input.sanctionedPrincipal,
      insurance_amount: input.insuranceAmount,
      interest_type: input.interestType,
      benchmark_name: input.benchmarkName || null,
      benchmark_spread_percent: input.benchmarkSpreadPercent,
      property_reference: input.propertyReference || null,
      notes: input.notes || null,
    })
    .eq("id", loan.id);

  if (result.error) throw result.error;

  const previousSpread = loan.benchmark_spread_percent === null ? null : Number(loan.benchmark_spread_percent);
  if (previousSpread === input.benchmarkSpreadPercent) return;

  // A corrected spread changes the contract formula, so keep the latest snapshot's expected rate in step.
  const latest = await supabase
    .from("rate_events")
    .select("id, lender_benchmark_rate")
    .eq("loan_id", loan.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) throw latest.error;
  if (!latest.data) return;

  const benchmark = latest.data.lender_benchmark_rate === null ? null : Number(latest.data.lender_benchmark_rate);
  const snapshotResult = await supabase
    .from("rate_events")
    .update({
      benchmark_spread_percent: input.benchmarkSpreadPercent,
      expected_loan_rate: benchmark !== null && input.benchmarkSpreadPercent !== null
        ? benchmark + input.benchmarkSpreadPercent
        : null,
    })
    .eq("id", latest.data.id);

  if (snapshotResult.error) throw snapshotResult.error;
}

export async function recordRateRevision(loan: LoanRow, latestRate: RateEventRow | null, input: RateRevisionInput) {
  const spread = loan.benchmark_spread_percent === null ? null : Number(loan.benchmark_spread_percent);
  const benchmark = latestRate?.lender_benchmark_rate === null || latestRate?.lender_benchmark_rate === undefined
    ? null
    : Number(latestRate.lender_benchmark_rate);

  const created = await supabase
    .from("rate_events")
    .insert({
      loan_id: loan.id,
      effective_date: input.effectiveDate,
      rbi_repo_rate: latestRate?.rbi_repo_rate ?? null,
      lender_benchmark_rate: benchmark,
      benchmark_spread_percent: spread,
      expected_loan_rate: benchmark !== null && spread !== null ? benchmark + spread : null,
      actual_applied_rate: input.newRate,
      notes: ["Rate revision recorded from the lender's notice or statement.", input.note].filter(Boolean).join(" "),
    })
    .select("id")
    .single();

  if (created.error) throw created.error;

  const loanResult = await supabase
    .from("loans")
    .update({ current_interest_rate: input.newRate })
    .eq("id", loan.id);

  if (loanResult.error) {
    await supabase.from("rate_events").delete().eq("id", created.data.id);
    throw loanResult.error;
  }
}

export async function exportLoanData(loanId: string) {
  const [loan, schedules, installments, payments, rateEvents, documents] = await Promise.all([
    supabase.from("loans").select("*").eq("id", loanId).single(),
    supabase.from("schedule_versions").select("*").eq("loan_id", loanId).order("version_number"),
    supabase
      .from("installments")
      .select("*, schedule_versions!inner(loan_id, version_number)")
      .eq("schedule_versions.loan_id", loanId)
      .order("due_date"),
    supabase.from("payments").select("*").eq("loan_id", loanId).order("payment_date"),
    supabase.from("rate_events").select("*").eq("loan_id", loanId).order("created_at"),
    supabase.from("documents").select("*").eq("loan_id", loanId).order("uploaded_at"),
  ]);

  for (const result of [loan, schedules, installments, payments, rateEvents, documents]) {
    if (result.error) throw result.error;
  }

  return {
    exportedAt: new Date().toISOString(),
    loan: loan.data,
    scheduleVersions: schedules.data ?? [],
    installments: (installments.data ?? []).map(({ schedule_versions: version, ...row }) => ({
      ...row,
      schedule_version_number: (version as { version_number?: number } | null)?.version_number ?? null,
    })),
    payments: payments.data ?? [],
    rateEvents: rateEvents.data ?? [],
    documents: documents.data ?? [],
  };
}
