"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoaderCircle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { planPrepayment, PrepaymentPlan, ReduceOption, ScheduleRevision } from "@/lib/amortization";
import { LoanRow, recordPrepayment } from "@/lib/loan-service";
import { cn } from "@/lib/utils";

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

const monthYear = (isoDate: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" })
  .format(new Date(`${isoDate}T00:00:00`));

function todayIso() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function tryPlan(run: () => PrepaymentPlan): { plan: PrepaymentPlan | null; error: string | null } {
  try {
    return { plan: run(), error: null };
  } catch (error) {
    return { plan: null, error: error instanceof Error ? error.message : "This prepayment can't be applied." };
  }
}

type PrepaymentDialogProps = {
  loan: LoanRow;
  annualRate: number;
  revisions: ScheduleRevision[];
  onSaved: () => void;
  trigger: React.ReactNode;
};

export function PrepaymentDialog({ loan, annualRate, revisions, onSaved, trigger }: PrepaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso);
  const [reduce, setReduce] = useState<ReduceOption>("tenure");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const latestRevisionDate = revisions.at(-1)?.effectiveDate;
  const minDate = [loan.regular_emi_start_date, latestRevisionDate].filter(Boolean).sort().at(-1) ?? undefined;
  const numericAmount = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(numericAmount);

  const options = useMemo(() => {
    if (!hasAmount || !date) return null;
    const plan = (option: ReduceOption) => tryPlan(() => planPrepayment(loan, annualRate, revisions, { date, amount: numericAmount, reduce: option }));
    return { tenure: plan("tenure"), emi: plan("emi") };
  }, [hasAmount, date, loan, annualRate, revisions, numericAmount]);

  const selected = options?.[reduce] ?? null;
  const validationError = selected?.error ?? (latestRevisionDate && date < latestRevisionDate ? "Date must be on or after your last prepayment." : null);

  function reset() {
    setAmount("");
    setDate(todayIso());
    setReduce("tenure");
    setReference("");
    setNotes("");
    setSaveError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.plan || validationError) return;

    setBusy(true);
    setSaveError(null);
    try {
      await recordPrepayment(loan.id, annualRate, {
        date,
        amount: numericAmount,
        reduce,
        transactionReference: reference.trim(),
        notes: notes.trim(),
        currentEmi: revisions.at(-1)?.emi ?? Number(loan.regular_emi_amount),
      }, selected.plan);
      setOpen(false);
      reset();
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the prepayment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-[#dce5e2] bg-white text-[#10201d] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record a prepayment</DialogTitle>
          <DialogDescription>An extra payment towards principal, such as a lump sum or an extra EMI. Your schedule updates from this date.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Amount (₹)</span>
              <Input type="number" inputMode="decimal" min="1" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 100000" />
              <button type="button" className="cursor-pointer text-xs font-semibold text-[#0f766e]" onClick={() => setAmount(String(revisions.at(-1)?.emi ?? loan.regular_emi_amount))}>Use one extra EMI</button>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>Paid on</span>
              <Input type="date" required value={date} min={minDate} max={todayIso()} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">After prepaying, I want to</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <ReduceChoice
                active={reduce === "tenure"}
                onSelect={() => setReduce("tenure")}
                title="Reduce tenure"
                badge="Saves most"
                detail={options?.tenure.plan ? `${options.tenure.plan.before.emisLeft - options.tenure.plan.after.emisLeft} fewer EMIs · save ${money(options.tenure.plan.interestSaved)}` : "Same EMI, loan ends sooner"}
              />
              <ReduceChoice
                active={reduce === "emi"}
                onSelect={() => setReduce("emi")}
                title="Reduce EMI"
                detail={options?.emi.plan ? `EMI ${money(options.emi.plan.after.emi)} · save ${money(options.emi.plan.interestSaved)}` : "Same end date, lower EMI"}
              />
            </div>
          </fieldset>

          {selected?.plan && !validationError ? <Preview plan={selected.plan} reduce={reduce} /> : null}
          {hasAmount && validationError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{validationError}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Transaction reference <span className="font-normal text-[#6a7f79]">(optional)</span></span>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR or receipt number" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>Note <span className="font-normal text-[#6a7f79]">(optional)</span></span>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Annual bonus" />
            </label>
          </div>

          <p className="text-xs leading-5 text-[#6a7f79]">Figures are estimates. Your lender may differ by a small amount because interest accrues daily between EMIs. Floating-rate home loans for individuals carry no prepayment charges under RBI rules.</p>
          {saveError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !selected?.plan || Boolean(validationError)} className="bg-[#173d35] text-white hover:bg-[#0d2824]">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Save prepayment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReduceChoice({ active, onSelect, title, badge, detail }: { active: boolean; onSelect: () => void; title: string; badge?: string; detail: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-xl border p-3 text-left transition",
        active ? "border-[#0f766e] bg-[#f3faf7] ring-1 ring-[#0f766e]" : "border-[#dce5e2] hover:bg-[#f7faf9]",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#173d35]">{title}</span>
        {badge ? <span className="rounded-full bg-[#d9f99d] px-2 py-0.5 text-[0.65rem] font-semibold text-[#173d35]">{badge}</span> : null}
      </span>
      <span className="mt-1 block text-xs leading-5 text-[#587069]">{detail}</span>
    </button>
  );
}

function Preview({ plan, reduce }: { plan: PrepaymentPlan; reduce: ReduceOption }) {
  return (
    <div className="rounded-xl bg-[#f4f7f6] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#173d35]"><TrendingDown className="size-4 text-[#0f766e]" />You save {money(plan.interestSaved)} in interest</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <PreviewRow label="Balance" before={money(plan.balanceBefore)} after={money(plan.openingPrincipal)} />
        {reduce === "tenure"
          ? <PreviewRow label="EMIs left" before={String(plan.before.emisLeft)} after={String(plan.after.emisLeft)} />
          : <PreviewRow label="EMI" before={money(plan.before.emi)} after={money(plan.after.emi)} />}
        <PreviewRow label="Last EMI" before={monthYear(plan.before.lastDate)} after={monthYear(plan.after.lastDate)} />
        <PreviewRow label="Interest left" before={money(plan.before.interest)} after={money(plan.after.interest)} />
      </dl>
    </div>
  );
}

function PreviewRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div>
      <dt className="text-xs text-[#6a7f79]">{label}</dt>
      <dd className="mt-0.5 text-[#173d35]"><span className="text-[#789089] line-through decoration-[#9fb8b2]">{before}</span> <span className="font-semibold">{after}</span></dd>
    </div>
  );
}
