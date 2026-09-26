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
};

export type YearType = "financial" | "calendar";

export type PeriodSummary = {
  key: string;
  label: string;
  shortLabel: string;
  principal: number;
  interest: number;
  total: number;
  closing: number;
  emiCount: number;
  rows: AmortizationRow[];
};

function addMonthsIso(isoDate: string, monthsToAdd: number) {
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

// Balances run on the exact EMI; each row is shown the way lender schedules print it:
// interest rounded to the rupee and principal = debited EMI − interest.
export function buildAmortization({ principal, annualRate, months, startDate, debitedEmi }: {
  principal: number;
  annualRate: number;
  months: number;
  startDate: string;
  debitedEmi?: number;
}): AmortizationRow[] {
  const r = annualRate / 1200;
  const emi = exactEmi(principal, annualRate, months);
  const printedEmi = debitedEmi !== undefined && Math.abs(debitedEmi - emi) < 1 ? debitedEmi : Math.ceil(emi - 1e-6);
  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let index = 0; index < months && balance > 0.005; index += 1) {
    const interest = balance * r;
    const principalPart = index === months - 1 ? balance : Math.min(balance, emi - interest);
    const closing = Math.max(0, balance - principalPart);
    const shownInterest = Math.round(interest);
    const shownEmi = closing === 0 && index < months - 1 ? Math.round(principalPart + interest) : printedEmi;
    rows.push({
      number: index + 1,
      dueDate: addMonthsIso(startDate, index),
      opening: balance,
      principal: shownEmi - shownInterest,
      interest: shownInterest,
      emi: shownEmi,
      closing,
      exactPrincipal: principalPart,
      exactInterest: interest,
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
function summarize(key: string, label: string, shortLabel: string, rows: AmortizationRow[]): PeriodSummary {
  const single = rows.length === 1;
  const principal = rows.reduce((sum, row) => sum + (single ? row.principal : row.exactPrincipal), 0);
  const interest = rows.reduce((sum, row) => sum + (single ? row.interest : row.exactInterest), 0);
  return {
    key,
    label,
    shortLabel,
    principal,
    interest,
    total: principal + interest,
    closing: rows.at(-1)?.closing ?? 0,
    emiCount: rows.length,
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

// The loan's full EMI schedule at a given rate; empty until the EMI start date is known.
export function loanSchedule(loan: {
  total_financed_amount: number;
  original_tenure_months: number;
  regular_emi_start_date: string | null;
  regular_emi_amount: number;
}, annualRate: number) {
  if (!loan.regular_emi_start_date) return [];
  return buildAmortization({
    principal: Number(loan.total_financed_amount),
    annualRate,
    months: loan.original_tenure_months,
    startDate: loan.regular_emi_start_date,
    debitedEmi: Number(loan.regular_emi_amount),
  });
}
