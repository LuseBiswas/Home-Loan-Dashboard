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
