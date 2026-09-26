export type AmortizationRow = {
  number: number;
  dueDate: string;
  opening: number;
  principal: number;
  interest: number;
  emi: number;
  closing: number;
  exactPrincipal: number;
  exactInterest: number;
  // Extra principal paid after this EMI; `closing` already reflects it.
  prepayment: number;
  // "first_installment" is the part payment before regular EMIs start (usually interest only).
  kind: "emi" | "first_installment";
};

export type YearType = "financial" | "calendar";

export type PeriodSummary = {
  key: string;
  label: string;
  shortLabel: string;
  principal: number;
  interest: number;
  total: number;
  prepaid: number;
  closing: number;
  emiCount: number;
  rows: AmortizationRow[];
};

export type ReduceOption = "tenure" | "emi";

// A schedule revision created by a part-prepayment (one `schedule_versions` row).
export type ScheduleRevision = {
  paymentId: string;
  effectiveDate: string;
  amount: number;
  openingPrincipal: number;
  emi: number;
  months: number;
  reduce: ReduceOption;
  isCurrent: boolean;
  transactionReference?: string | null;
  notes?: string | null;
};

export function addMonthsIso(isoDate: string, monthsToAdd: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const targetMonth = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return [
    targetYear,
    String(normalizedMonth + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

// Exact reducing-balance EMI. Lenders compute with this unrounded value and only print it
// rounded, so using the printed EMI instead drifts by ~₹1,000 over a 30-year schedule.
export function exactEmi(principal: number, annualRate: number, months: number) {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 1200;
  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

function printedEmiFor(exact: number, debitedEmi?: number) {
  return debitedEmi !== undefined && Math.abs(debitedEmi - exact) < 1 ? debitedEmi : Math.ceil(exact - 1e-6);
}

// Longest schedule a fixed-EMI segment may run to, so a large rate rise can't loop forever.
const MAX_FIXED_EMI_MONTHS = 600;

// Balances run on the exact EMI; each row is shown the way lender schedules print it:
// interest rounded to the rupee and principal = debited EMI − interest.
// `monthOffset` places a later segment on the loan's original due-date calendar, and
// `fixedEmi` keeps the EMI unchanged and runs until the balance is repaid (tenure shrinks).
export function buildAmortization({ principal, annualRate, months, startDate, debitedEmi, monthOffset = 0, fixedEmi }: {
  principal: number;
  annualRate: number;
  months: number;
  startDate: string;
  debitedEmi?: number;
  monthOffset?: number;
  fixedEmi?: number;
}): AmortizationRow[] {
  const r = annualRate / 1200;
  const emi = fixedEmi ?? exactEmi(principal, annualRate, months);
  const limit = fixedEmi === undefined ? months : MAX_FIXED_EMI_MONTHS;
  const printedEmi = printedEmiFor(emi, debitedEmi);
  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let index = 0; index < limit && balance > 0.005; index += 1) {
    const interest = balance * r;
    const principalPart = index === limit - 1 ? balance : Math.min(balance, emi - interest);
    const closing = Math.max(0, balance - principalPart);
    const shownInterest = Math.round(interest);
    const shownEmi = closing === 0 && index < limit - 1 ? Math.round(principalPart + interest) : printedEmi;
    rows.push({
      number: monthOffset + index + 1,
      dueDate: addMonthsIso(startDate, monthOffset + index),
      opening: balance,
      principal: shownEmi - shownInterest,
      interest: shownInterest,
      emi: shownEmi,
      closing,
      exactPrincipal: principalPart,
      exactInterest: interest,
      prepayment: 0,
      kind: "emi",
    });
    balance = closing;
  }

  return rows;
}

// Indian financial year runs April to March, e.g. FY 2026–27 = Apr 2026 – Mar 2027.
export function periodStartYear(isoDate: string, yearType: YearType) {
  const [year, month] = isoDate.split("-").map(Number);
  return yearType === "financial" && month < 4 ? year - 1 : year;
}

export function periodLabel(startYear: number, yearType: YearType) {
  return yearType === "financial"
    ? `FY ${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`
    : String(startYear);
}

function periodShortLabel(startYear: number, yearType: YearType) {
  return yearType === "financial"
    ? `${String(startYear % 100).padStart(2, "0")}–${String((startYear + 1) % 100).padStart(2, "0")}`
    : String(startYear);
}

// A single month reads exactly like the lender's printed row; multi-month totals add the
// unrounded parts so rounding doesn't accumulate (full-term principal equals the loan).
// Prepayments count as principal repaid in the period they were made.
function summarize(key: string, label: string, shortLabel: string, rows: AmortizationRow[]): PeriodSummary {
  const single = rows.length === 1;
  const prepaid = rows.reduce((sum, row) => sum + row.prepayment, 0);
  const principal = rows.reduce((sum, row) => sum + (single ? row.principal : row.exactPrincipal), 0) + prepaid;
  const interest = rows.reduce((sum, row) => sum + (single ? row.interest : row.exactInterest), 0);
  return {
    key,
    label,
    shortLabel,
    principal,
    interest,
    total: principal + interest,
    prepaid,
    closing: rows.at(-1)?.closing ?? 0,
    emiCount: rows.filter(isEmi).length,
    rows,
  };
}

export function groupByYear(rows: AmortizationRow[], yearType: YearType): PeriodSummary[] {
  const groups = new Map<number, AmortizationRow[]>();
  for (const row of rows) {
    const year = periodStartYear(row.dueDate, yearType);
    const group = groups.get(year);
    if (group) group.push(row);
    else groups.set(year, [row]);
  }

  return [...groups.entries()].map(([year, group]) =>
    summarize(String(year), periodLabel(year, yearType), periodShortLabel(year, yearType), group));
}

const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short" });
const monthYearFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

export function monthsOf(period: PeriodSummary): PeriodSummary[] {
  return period.rows.map((row) => {
    const date = new Date(`${row.dueDate}T00:00:00`);
    return summarize(row.dueDate, monthYearFormat.format(date), monthFormat.format(date), [row]);
  });
}

export function totalsOf(rows: AmortizationRow[]) {
  return summarize("all", "Full term", "All", rows);
}

// First EMI where more of the payment reduces the loan than pays interest.
export function crossoverRow(rows: AmortizationRow[]) {
  return rows.find((row) => row.principal > row.interest) ?? null;
}

type LoanTerms = {
  total_financed_amount: number;
  original_tenure_months: number;
  regular_emi_start_date: string | null;
  regular_emi_amount: number;
  first_installment_amount?: number | null;
  first_installment_date?: string | null;
};

export function isEmi(row: AmortizationRow) {
  return row.kind === "emi";
}

// The first installment collected before regular EMIs begin. Lenders collect it as interest
// for the days between disbursement and the EMI cycle, so it doesn't reduce the principal.
function firstInstallmentRow(loan: LoanTerms): AmortizationRow | null {
  const amount = Number(loan.first_installment_amount ?? 0);
  const date = loan.first_installment_date;
  if (!date || !(amount > 0) || !loan.regular_emi_start_date || date >= loan.regular_emi_start_date) return null;
  const principal = Number(loan.total_financed_amount);
  return {
    number: 0,
    dueDate: date,
    opening: principal,
    principal: 0,
    interest: Math.round(amount),
    emi: Math.round(amount),
    closing: principal,
    exactPrincipal: 0,
    exactInterest: amount,
    prepayment: 0,
    kind: "first_installment",
  };
}

type LoanPath = {
  rows: AmortizationRow[];
  exactEmi: number;
  printedEmi: number;
};

function lastIndexOnOrBefore(rows: AmortizationRow[], isoDate: string) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].dueDate <= isoDate) return index;
  }
  return -1;
}

// Applies one prepayment: EMIs up to the prepayment date stay, the balance drops by the
// prepaid amount, and the rest is rebuilt with the same EMI (shorter tenure) or the same
// tenure (lower EMI). Returns null when the date falls outside the loan's EMIs.
function applyRevision(path: LoanPath, startDate: string, annualRate: number, revision: Pick<ScheduleRevision, "effectiveDate" | "amount" | "openingPrincipal" | "emi" | "months" | "reduce">): LoanPath | null {
  const cut = lastIndexOnOrBefore(path.rows, revision.effectiveDate);
  if (cut < 0 || cut >= path.rows.length - 1) return null;

  const kept = path.rows.slice(0, cut + 1);
  kept[cut] = { ...kept[cut], prepayment: kept[cut].prepayment + revision.amount, closing: revision.openingPrincipal };

  const keepEmi = revision.reduce === "tenure";
  const segmentExactEmi = keepEmi ? path.exactEmi : exactEmi(revision.openingPrincipal, annualRate, revision.months);
  const segment = buildAmortization({
    principal: revision.openingPrincipal,
    annualRate,
    months: revision.months,
    startDate,
    debitedEmi: revision.emi,
    monthOffset: cut + 1,
    fixedEmi: keepEmi ? path.exactEmi : undefined,
  });

  return { rows: [...kept, ...segment], exactEmi: segmentExactEmi, printedEmi: printedEmiFor(segmentExactEmi, revision.emi) };
}

function loanPath(loan: LoanTerms, annualRate: number, revisions: ScheduleRevision[]): LoanPath | null {
  if (!loan.regular_emi_start_date) return null;
  const principal = Number(loan.total_financed_amount);
  const months = loan.original_tenure_months;
  const originalExact = exactEmi(principal, annualRate, months);
  let path: LoanPath = {
    rows: buildAmortization({ principal, annualRate, months, startDate: loan.regular_emi_start_date, debitedEmi: Number(loan.regular_emi_amount) }),
    exactEmi: originalExact,
    printedEmi: printedEmiFor(originalExact, Number(loan.regular_emi_amount)),
  };

  for (const revision of revisions) {
    path = applyRevision(path, loan.regular_emi_start_date, annualRate, revision) ?? path;
  }
  return path;
}

// The loan's full repayment schedule at a given rate: the first installment (if any), every
// EMI, and any prepayments. Empty until the EMI start date is known.
export function loanSchedule(loan: LoanTerms, annualRate: number, revisions: ScheduleRevision[] = []) {
  const rows = loanPath(loan, annualRate, revisions)?.rows ?? [];
  const first = rows.length > 0 ? firstInstallmentRow(loan) : null;
  return first ? [first, ...rows] : rows;
}

export type PrepaymentPlan = {
  balanceBefore: number;
  openingPrincipal: number;
  newEmi: number;
  installments: AmortizationRow[];
  before: { emi: number; emisLeft: number; lastDate: string; interest: number };
  after: { emi: number; emisLeft: number; lastDate: string; interest: number };
  interestSaved: number;
};

// Works out what a prepayment would do, without saving anything. Throws a readable error when
// the prepayment can't be applied.
export function planPrepayment(loan: LoanTerms, annualRate: number, revisions: ScheduleRevision[], input: { date: string; amount: number; reduce: ReduceOption }): PrepaymentPlan {
  const path = loanPath(loan, annualRate, revisions);
  if (!path || !loan.regular_emi_start_date) throw new Error("Add your EMI start date before recording a prepayment.");

  const cut = lastIndexOnOrBefore(path.rows, input.date);
  if (cut < 0) throw new Error("Prepayments can be recorded from your first EMI date onwards.");
  if (cut >= path.rows.length - 1) throw new Error("There are no EMIs left after this date.");

  const balanceBefore = path.rows[cut].closing;
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than zero.");
  if (input.amount >= balanceBefore) throw new Error("A prepayment must be less than your outstanding balance.");

  const openingPrincipal = balanceBefore - input.amount;
  const remaining = path.rows.slice(cut + 1);
  const emisLeft = remaining.length;
  const newExact = input.reduce === "tenure" ? path.exactEmi : exactEmi(openingPrincipal, annualRate, emisLeft);
  const revised = applyRevision(path, loan.regular_emi_start_date, annualRate, {
    effectiveDate: input.date,
    amount: input.amount,
    openingPrincipal,
    emi: input.reduce === "tenure" ? path.printedEmi : printedEmiFor(newExact),
    months: emisLeft,
    reduce: input.reduce,
  });
  if (!revised) throw new Error("This prepayment can't be applied to your schedule.");

  const installments = revised.rows.slice(cut + 1);
  const interestOf = (rows: AmortizationRow[]) => rows.reduce((sum, row) => sum + row.exactInterest, 0);
  const before = { emi: remaining[0].emi, emisLeft, lastDate: remaining.at(-1)!.dueDate, interest: interestOf(remaining) };
  const after = { emi: installments[0].emi, emisLeft: installments.length, lastDate: installments.at(-1)!.dueDate, interest: interestOf(installments) };

  return {
    balanceBefore,
    openingPrincipal,
    newEmi: installments[0].emi,
    installments,
    before,
    after,
    interestSaved: before.interest - after.interest,
  };
}
