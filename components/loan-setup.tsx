"use client";

import { FormEvent, useState } from "react";
import { Landmark, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createLoanProfile } from "@/lib/loan-service";

function nullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return Number(value);
}

export function LoanSetup({ userId, onCreated, onSignOut }: { userId: string; onCreated: () => void; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      await createLoanProfile(userId, {
        lenderName: String(form.get("lenderName") ?? "").trim(),
        loanReference: String(form.get("loanReference") ?? "").trim(),
        sanctionedPrincipal: Number(form.get("sanctionedPrincipal")),
        insuranceAmount: nullableNumber(form.get("insuranceAmount")) ?? 0,
        interestType: String(form.get("interestType")) as "floating" | "fixed" | "hybrid",
        benchmarkName: String(form.get("benchmarkName") ?? "").trim(),
        benchmarkSpreadPercent: nullableNumber(form.get("benchmarkSpreadPercent")),
        currentInterestRate: Number(form.get("currentInterestRate")),
        regularEmiAmount: Number(form.get("regularEmiAmount")),
        firstInstallmentAmount: nullableNumber(form.get("firstInstallmentAmount")),
        firstInstallmentDate: String(form.get("firstInstallmentDate") ?? ""),
        regularEmiStartDate: String(form.get("regularEmiStartDate") ?? ""),
        originalTenureMonths: Number(form.get("originalTenureMonths")),
        rateEffectiveDate: String(form.get("rateEffectiveDate") ?? ""),
        rbiRepoRate: nullableNumber(form.get("rbiRepoRate")),
        lenderBenchmarkRate: nullableNumber(form.get("lenderBenchmarkRate")),
        rateSourceUrl: String(form.get("rateSourceUrl") ?? "").trim(),
      });
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the loan profile.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6] px-5 py-8 text-[#10201d] md:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#d9f99d] text-[#173d35]"><Landmark className="size-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6a7f79]">Home Loan Compass</p><h1 className="text-xl font-semibold">Create your loan profile</h1></div>
          </div>
          <Button type="button" variant="outline" onClick={onSignOut}><LogOut className="size-4" />Sign out</Button>
        </div>

        <form onSubmit={submit}>
          <Card className="border-[#dce5e2] bg-white shadow-[0_16px_50px_rgba(20,50,44,0.06)]">
            <CardHeader>
              <h2 className="text-lg font-semibold">Loan terms</h2>
              <p className="text-sm leading-6 text-[#6a7f79]">Enter the values shown in your lender documents. These values will be saved to Supabase.</p>
            </CardHeader>
            <CardContent className="grid gap-5 px-6 md:grid-cols-2">
              <Field label="Lender name" name="lenderName" required />
              <Field label="Masked loan reference" name="loanReference" placeholder="Do not enter a full sensitive account number" />
              <Field label="Sanctioned principal (₹)" name="sanctionedPrincipal" type="number" min="0.01" step="0.01" required />
              <Field label="Financed insurance (₹)" name="insuranceAmount" type="number" min="0" step="0.01" />
              <label className="space-y-1.5 text-sm font-medium">Interest type<select name="interestType" required defaultValue="" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"><option value="" disabled>Select type</option><option value="floating">Floating</option><option value="fixed">Fixed</option><option value="hybrid">Hybrid</option></select></label>
              <Field label="Current interest rate (%)" name="currentInterestRate" type="number" min="0" max="100" step="0.0001" required />
              <Field label="Regular EMI (₹)" name="regularEmiAmount" type="number" min="0.01" step="0.01" required />
              <Field label="Original tenure (months)" name="originalTenureMonths" type="number" min="1" step="1" required />
              <Field label="Regular EMI start date" name="regularEmiStartDate" type="date" required />
              <div />
              <Field label="First installment amount (₹)" name="firstInstallmentAmount" type="number" min="0" step="0.01" />
              <Field label="First installment date" name="firstInstallmentDate" type="date" />
            </CardContent>

            <div className="mx-6 border-t border-[#e5ece9]" />

            <CardHeader>
              <h2 className="text-lg font-semibold">Rate benchmark snapshot</h2>
              <p className="text-sm leading-6 text-[#6a7f79]">Optional. Add only values you can verify from an RBI or lender source.</p>
            </CardHeader>
            <CardContent className="grid gap-5 px-6 md:grid-cols-2">
              <Field label="Benchmark name" name="benchmarkName" placeholder="For example: lender benchmark name" />
              <Field label="Benchmark spread (%)" name="benchmarkSpreadPercent" type="number" step="0.0001" />
              <Field label="RBI repo rate (%)" name="rbiRepoRate" type="number" min="0" max="100" step="0.0001" />
              <Field label="Lender benchmark rate (%)" name="lenderBenchmarkRate" type="number" min="0" max="100" step="0.0001" />
              <Field label="Rate effective date" name="rateEffectiveDate" type="date" />
              <Field label="Official source URL" name="rateSourceUrl" type="url" placeholder="https://…" />

              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-700 md:col-span-2">{error}</p> : null}

              <div className="flex flex-col gap-4 border-t border-[#e5ece9] pt-5 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex max-w-lg items-start gap-2 text-xs leading-5 text-[#6a7f79]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0f766e]" />All submitted financial values are written to your private Supabase records and protected by row-level security.</p>
                <Button disabled={busy} className="bg-[#173d35] text-white hover:bg-[#0d2824]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Save and open dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </main>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return <label className="space-y-1.5 text-sm font-medium">{label}<Input name={name} {...props} /></label>;
}
