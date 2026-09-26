"use client";

import { FormEvent, useState } from "react";
import { Landmark, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LoanRow, updateLoanDetails } from "@/lib/loan-service";
import { clearRateCheck } from "@/lib/rate-monitor";
import {
  errorMessage, Field, FormStatus, money, percent, ReadOnlyValue, SectionHeading, selectClassName, shortDate, StatusMessage,
} from "./profile-ui";
import { useDemoMode } from "@/lib/demo";
import { DemoNote } from "@/components/demo-note";

function nullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return Number(value);
}

export function LoanDetailsCard({ loan, onSaved }: { loan: LoanRow; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const demo = useDemoMode();
  const [status, setStatus] = useState<FormStatus>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const form = new FormData(event.currentTarget);
    try {
      await updateLoanDetails(loan, {
        lenderName: String(form.get("lenderName") ?? "").trim(),
        loanReference: String(form.get("loanReference") ?? "").trim(),
        sanctionedPrincipal: Number(form.get("sanctionedPrincipal")),
        insuranceAmount: nullableNumber(form.get("insuranceAmount")) ?? 0,
        interestType: String(form.get("interestType")) as LoanRow["interest_type"],
        benchmarkName: String(form.get("benchmarkName") ?? "").trim(),
        benchmarkSpreadPercent: nullableNumber(form.get("benchmarkSpreadPercent")),
        propertyReference: String(form.get("propertyReference") ?? "").trim(),
        notes: String(form.get("notes") ?? "").trim(),
      });
      clearRateCheck(loan.id);
      setStatus({ tone: "success", text: "Loan details saved. The rate check will re-run when you next open the dashboard." });
      onSaved();
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Could not save loan details.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-[#dce5e2] bg-white shadow-none">
      <CardContent className="px-5 md:px-6">
        <SectionHeading icon={Landmark} title="Loan details" description="Correct the terms from your sanction letter. Changes apply across your dashboard." />

        <form onSubmit={submit} className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Lender name" name="lenderName" defaultValue={loan.lender_name} required />
          <Field label="Masked loan reference" name="loanReference" defaultValue={loan.loan_reference_masked ?? ""} placeholder="e.g. XXXX1234" hint="Never enter the full account number." />
          <Field label="Sanctioned principal (₹)" name="sanctionedPrincipal" type="number" min="0.01" step="0.01" defaultValue={loan.sanctioned_principal} required />
          <Field label="Financed insurance (₹)" name="insuranceAmount" type="number" min="0" step="0.01" defaultValue={loan.insurance_amount} />
          <label className="space-y-1.5 text-sm font-medium">
            <span>Interest type</span>
            <select name="interestType" required defaultValue={loan.interest_type} className={selectClassName}>
              <option value="floating">Floating</option>
              <option value="fixed">Fixed</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <Field label="Benchmark name" name="benchmarkName" defaultValue={loan.benchmark_name ?? ""} placeholder="e.g. PNBRRR" />
          <Field label="Contractual spread (%)" name="benchmarkSpreadPercent" type="number" step="0.0001" min="-100" max="100" defaultValue={loan.benchmark_spread_percent ?? ""} hint="Used for: expected rate = benchmark + spread." />
          <Field label="Property reference" name="propertyReference" defaultValue={loan.property_reference ?? ""} placeholder="e.g. Flat 402, Tower B" />
          <label className="space-y-1.5 text-sm font-medium md:col-span-2">
            <span>Notes</span>
            <Textarea name="notes" rows={3} defaultValue={loan.notes ?? ""} placeholder="Anything worth remembering about this loan" />
          </label>

          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6a7f79]">Repayment terms</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ReadOnlyValue label="Applied rate" value={percent(loan.current_interest_rate)} />
              <ReadOnlyValue label="Regular EMI" value={money(Number(loan.regular_emi_amount))} />
              <ReadOnlyValue label="Original tenure" value={`${loan.original_tenure_months} months`} />
              <ReadOnlyValue label="EMI starts" value={loan.regular_emi_start_date ? shortDate(loan.regular_emi_start_date) : "—"} />
            </div>
            <p className="mt-2 text-xs leading-5 text-[#6a7f79]">These drive your repayment schedule, so they aren&apos;t edited here. Record rate changes under Rate revisions.</p>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e5ece9] pt-5 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1"><StatusMessage status={status} /><DemoNote /></div>
            <Button disabled={busy || demo} className="bg-[#173d35] text-white hover:bg-[#0d2824]">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
