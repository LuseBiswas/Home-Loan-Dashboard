import type { Session } from "@supabase/supabase-js";
import type { ScheduleRevision } from "@/lib/amortization";
import { addMonthsIso, exactEmi, loanSchedule, periodStartYear, planPrepayment } from "@/lib/amortization";
import type { LoanDocument } from "@/lib/document-service";
import type { DashboardData, LoanRow, RateHistoryRow } from "@/lib/loan-service";

// Sample loan for demo mode. Dates are relative to today so the demo always shows EMIs already
// paid, a past prepayment and upcoming instalments. None of it belongs to a real person.
const RATE = 8.75;
const FINANCED = 5_000_000;
const TENURE_MONTHS = 240;

function localIso(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function monthStart(offsetMonths: number, day: number) {
  const today = localIso(new Date());
  return addMonthsIso(`${today.slice(0, 7)}-${String(day).padStart(2, "0")}`, offsetMonths);
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

type DemoWorld = {
  session: Session;
  loan: LoanRow;
  revisions: ScheduleRevision[];
  rateHistory: RateHistoryRow[];
  documents: LoanDocument[];
};

let world: DemoWorld | null = null;

function buildWorld(): DemoWorld {
  const emiStart = monthStart(-26, 5);
  const emi = Math.ceil(exactEmi(FINANCED, RATE, TENURE_MONTHS) - 1e-6);

  const loan: LoanRow = {
    id: "demo-loan",
    lender_name: "Sample Housing Finance",
    loan_reference_masked: "XXXX4821",
    sanctioned_principal: 4_800_000,
    insurance_amount: 200_000,
    total_financed_amount: FINANCED,
    current_interest_rate: RATE,
    regular_emi_amount: emi,
    first_installment_amount: null,
    first_installment_date: null,
    regular_emi_start_date: emiStart,
    original_tenure_months: TENURE_MONTHS,
    interest_type: "floating",
    benchmark_name: "Sample RLLR",
    benchmark_spread_percent: -0.5,
    property_reference: "Flat 1203, Tower C (sample)",
    notes: "Sample data for the demo.",
    created_at: `${addMonthsIso(emiStart, -1)}T10:00:00.000Z`,
  };

  const prepaymentDate = monthStart(-8, 12);
  const plan = planPrepayment(loan, RATE, [], { date: prepaymentDate, amount: 200_000, reduce: "tenure" });
  const revisions: ScheduleRevision[] = [{
    paymentId: "demo-prepayment-1",
    effectiveDate: prepaymentDate,
    amount: 200_000,
    openingPrincipal: plan.openingPrincipal,
    emi,
    months: plan.installments.length,
    reduce: "tenure",
    isCurrent: true,
    transactionReference: "UTR-SAMPLE-0192",
    notes: "Annual bonus",
  }];

  const revisionDate = monthStart(-10, 1);
  const rateHistory: RateHistoryRow[] = [
    {
      id: "demo-rate-3",
      effective_date: localIso(new Date()),
      rbi_repo_rate: 5.5,
      lender_benchmark_rate: 9.25,
      expected_loan_rate: 8.75,
      actual_applied_rate: 8.75,
      verified_at: daysAgoIso(0.1),
      source_url: null,
      notes: "Automatically checked against official sources (sample).",
      created_at: daysAgoIso(0.1),
    },
    {
      id: "demo-rate-2",
      effective_date: revisionDate,
      rbi_repo_rate: 5.5,
      lender_benchmark_rate: 9.25,
      expected_loan_rate: 8.75,
      actual_applied_rate: 8.75,
      verified_at: null,
      source_url: null,
      notes: "Rate revision recorded from the lender's notice or statement. Repo cut passed on.",
      created_at: `${revisionDate}T09:00:00.000Z`,
    },
    {
      id: "demo-rate-1",
      effective_date: emiStart,
      rbi_repo_rate: 5.75,
      lender_benchmark_rate: 9.5,
      expected_loan_rate: 9,
      actual_applied_rate: 9,
      verified_at: null,
      source_url: null,
      notes: null,
      created_at: loan.created_at,
    },
  ];

  const lastFinishedYear = periodStartYear(localIso(new Date()), "financial") - 1;
  const document = (id: string, category: LoanDocument["category"], file_name: string, uploaded: string, size: number, period?: [string, string]): LoanDocument => ({
    id,
    category,
    file_name,
    storage_path: `demo/${id}.pdf`,
    mime_type: "application/pdf",
    file_size_bytes: size,
    statement_period_start: period?.[0] ?? null,
    statement_period_end: period?.[1] ?? null,
    uploaded_at: uploaded,
  });
  const documents: LoanDocument[] = [
    document("demo-doc-1", "payment_receipt", "Prepayment receipt – ₹2,00,000", `${prepaymentDate}T12:00:00.000Z`, 182_000),
    document("demo-doc-2", "interest_certificate", `Interest certificate FY ${lastFinishedYear}–${String((lastFinishedYear + 1) % 100).padStart(2, "0")}`, `${lastFinishedYear + 1}-04-20T12:00:00.000Z`, 96_000, [`${lastFinishedYear}-04-01`, `${lastFinishedYear + 1}-03-31`]),
    document("demo-doc-3", "loan_statement", "Loan statement", `${lastFinishedYear + 1}-04-22T12:00:00.000Z`, 240_000, [`${lastFinishedYear}-04-01`, `${lastFinishedYear + 1}-03-31`]),
    document("demo-doc-4", "disbursement_letter", "Disbursement letter", loan.created_at, 1_450_000),
    document("demo-doc-5", "sanction_letter", "Sanction letter", loan.created_at, 1_120_000),
  ];

  const session = {
    access_token: "demo",
    token_type: "bearer",
    expires_in: 0,
    refresh_token: "demo",
    user: {
      id: "demo-user",
      email: "demo@example.com",
      email_confirmed_at: loan.created_at,
      created_at: loan.created_at,
      last_sign_in_at: daysAgoIso(0),
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
    },
  } as unknown as Session;

  return { session, loan, revisions, rateHistory, documents };
}

function demoWorld() {
  world ??= buildWorld();
  return world;
}

export const demoSession = () => demoWorld().session;
export const demoLoan = () => demoWorld().loan;
export const demoRevisions = () => demoWorld().revisions;
export const demoRateHistory = () => demoWorld().rateHistory;
export const demoDocuments = () => demoWorld().documents;

export function demoDashboardDetails(): Omit<DashboardData, "loan"> {
  const { loan, revisions, rateHistory } = demoWorld();
  const schedule = loanSchedule(loan, RATE, revisions);
  return {
    installments: schedule.map((row) => ({
      id: `demo-installment-${row.number}`,
      installment_number: row.number,
      installment_type: row.kind === "first_installment" ? "first_installment" : "regular_emi",
      due_date: row.dueDate,
      scheduled_amount: row.emi,
    })),
    latestRate: rateHistory[0],
    previousRate: rateHistory[1],
    payments: [],
    revisions,
  };
}
