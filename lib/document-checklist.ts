import type { AmortizationRow } from "@/lib/amortization";
import { periodLabel, periodStartYear } from "@/lib/amortization";
import type { DocumentCategory, LoanDocument } from "@/lib/document-service";

export type ChecklistItem = {
  key: string;
  label: string;
  detail: string;
  status: "done" | "missing" | "upcoming";
  category: DocumentCategory;
  // Pre-fills the upload form, e.g. the financial year of an interest certificate.
  financialYear?: number;
};

const count = (documents: LoanDocument[], category: DocumentCategory) =>
  documents.filter((document) => document.category === category).length;

function financialYearOf(document: LoanDocument) {
  const date = document.statement_period_start ?? document.statement_period_end;
  return date ? periodStartYear(date, "financial") : null;
}

// What a borrower should keep for this loan, based on its schedule and history.
export function documentChecklist({ documents, schedule, today, prepaymentCount, rateRevisionCount }: {
  documents: LoanDocument[];
  schedule: AmortizationRow[];
  today: string;
  prepaymentCount: number;
  rateRevisionCount: number;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      key: "sanction",
      label: "Sanction letter",
      detail: "Your approved loan amount, rate and terms.",
      status: count(documents, "sanction_letter") > 0 ? "done" : "missing",
      category: "sanction_letter",
    },
    {
      key: "disbursement",
      label: "Disbursement letter",
      detail: "Final terms and the lender's repayment schedule.",
      status: count(documents, "disbursement_letter") > 0 ? "done" : "missing",
      category: "disbursement_letter",
    },
  ];

  // One interest certificate per financial year that had payments. Lenders issue it after
  // 31 March, so the running year is shown as upcoming rather than missing.
  const certificateYears = new Set(
    documents.filter((document) => document.category === "interest_certificate").map(financialYearOf).filter((year) => year !== null),
  );
  const yearsWithPayments = [...new Set(schedule.filter((row) => row.dueDate <= today).map((row) => periodStartYear(row.dueDate, "financial")))];
  const currentYear = periodStartYear(today, "financial");
  if (schedule.some((row) => periodStartYear(row.dueDate, "financial") === currentYear) && !yearsWithPayments.includes(currentYear)) {
    yearsWithPayments.push(currentYear);
  }

  for (const year of yearsWithPayments.sort((a, b) => a - b)) {
    const label = periodLabel(year, "financial");
    const finished = year < currentYear;
    items.push({
      key: `certificate-${year}`,
      label: `Interest certificate ${label}`,
      detail: finished
        ? "Needed to claim tax deductions under Sections 24(b) and 80C."
        : `Ask your lender for it after 31 Mar ${year + 1}, for your tax return.`,
      status: certificateYears.has(year) ? "done" : finished ? "missing" : "upcoming",
      category: "interest_certificate",
      financialYear: year,
    });
  }

  if (prepaymentCount > 0) {
    const receipts = count(documents, "payment_receipt");
    items.push({
      key: "prepayment-receipts",
      label: prepaymentCount === 1 ? "Prepayment receipt" : "Prepayment receipts",
      detail: `${Math.min(receipts, prepaymentCount)} of ${prepaymentCount} prepayment${prepaymentCount === 1 ? "" : "s"} have a receipt. Proof the lender received the money.`,
      status: receipts >= prepaymentCount ? "done" : "missing",
      category: "payment_receipt",
    });
  }

  if (rateRevisionCount > 0) {
    const letters = count(documents, "rate_revision_letter");
    items.push({
      key: "rate-letters",
      label: rateRevisionCount === 1 ? "Rate revision letter" : "Rate revision letters",
      detail: `${Math.min(letters, rateRevisionCount)} of ${rateRevisionCount} rate change${rateRevisionCount === 1 ? "" : "s"} have the lender's letter. Your evidence if a rate is ever disputed.`,
      status: letters >= rateRevisionCount ? "done" : "missing",
      category: "rate_revision_letter",
    });
  }

  return items;
}
