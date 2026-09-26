"use client";

import { FormEvent, useRef, useState } from "react";
import { History, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoanRow, RateHistoryRow, recordRateRevision } from "@/lib/loan-service";
import { clearRateCheck } from "@/lib/rate-monitor";
import { errorMessage, Field, FormStatus, percent, SectionHeading, shortDate, StatusMessage } from "./profile-ui";
import { useDemoMode } from "@/lib/demo";
import { DemoNote } from "@/components/demo-note";

function todayIso() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export function RateRevisionCard({ loan, history, onSaved }: { loan: LoanRow; history: RateHistoryRow[]; onSaved: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const demo = useDemoMode();
  const [status, setStatus] = useState<FormStatus>(null);
  const currentRate = Number(loan.current_interest_rate);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const form = new FormData(event.currentTarget);
    const newRate = Number(form.get("newRate"));
    if (Math.abs(newRate - currentRate) < 0.00005) {
      setStatus({ tone: "error", text: `${percent(newRate)} is already your applied rate.` });
      return;
    }

    setBusy(true);
    try {
      await recordRateRevision(loan, history[0] ?? null, {
        newRate,
        effectiveDate: String(form.get("effectiveDate")),
        note: String(form.get("note") ?? "").trim(),
      });
      clearRateCheck(loan.id);
      formRef.current?.reset();
      setStatus({ tone: "success", text: `Applied rate updated from ${percent(currentRate)} to ${percent(newRate)}.` });
      onSaved();
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Could not record the rate revision.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-[#dce5e2] bg-white shadow-none">
      <CardContent className="px-5 md:px-6">
        <SectionHeading
          icon={History}
          title="Rate revisions"
          description="When your lender changes your rate, record it here so the contract check stays accurate."
          action={<div className="shrink-0 rounded-xl bg-[#102f2a] px-3 py-2 text-right text-white"><p className="text-[0.68rem] text-[#9ec0b8]">Applied now</p><p className="text-sm font-semibold">{percent(currentRate)}</p></div>}
        />

        <form ref={formRef} onSubmit={submit} className="mt-6 grid gap-5 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
          <Field label="New applied rate (%)" name="newRate" type="number" min="0" max="100" step="0.0001" required />
          <Field label="Effective from" name="effectiveDate" type="date" defaultValue={todayIso()} max={todayIso()} required />
          <Field label="Note (optional)" name="note" placeholder="e.g. Rate revision letter dated…" />
          <Button disabled={busy || demo} className="bg-[#173d35] text-white hover:bg-[#0d2824]">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Record revision
          </Button>
        </form>
        <div className="mt-3 space-y-2"><StatusMessage status={status} /><DemoNote /></div>
        <p className="mt-3 text-xs leading-5 text-[#6a7f79]">Use the rate on your statement or revision notice, not the lender&apos;s advertised rate.</p>

        <div className="mt-6 border-t border-[#e5ece9] pt-5">
          <p className="text-sm font-semibold">Rate history</p>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-[#6a7f79]">No rate snapshots yet. Run a rate check from the dashboard to start your history.</p>
          ) : (
            <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-[#e5ece9]">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-[#f4f7f6] text-xs text-[#6a7f79]">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Effective</th>
                    <th className="px-3 py-2.5 font-medium">Applied</th>
                    <th className="px-3 py-2.5 font-medium">Expected</th>
                    <th className="px-3 py-2.5 font-medium">{loan.benchmark_name ?? "Benchmark"}</th>
                    <th className="px-3 py-2.5 font-medium">RBI repo</th>
                    <th className="px-3 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const expected = row.expected_loan_rate === null ? null : Number(row.expected_loan_rate);
                    const applied = row.actual_applied_rate === null ? null : Number(row.actual_applied_rate);
                    const diffBps = expected !== null && applied !== null ? Math.round((applied - expected) * 100) : null;
                    return (
                      <tr key={row.id} className="border-t border-[#eef3f1]">
                        <td className="px-3 py-2.5 whitespace-nowrap">{shortDate(row.effective_date)}</td>
                        <td className="px-3 py-2.5 font-semibold">{percent(applied)}</td>
                        <td className="px-3 py-2.5">
                          {percent(expected)}
                          {diffBps !== null && Math.abs(diffBps) > 1 ? <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[0.68rem] font-semibold text-amber-700">{diffBps > 0 ? "+" : ""}{diffBps} bps</span> : null}
                        </td>
                        <td className="px-3 py-2.5">{percent(row.lender_benchmark_rate)}</td>
                        <td className="px-3 py-2.5">{percent(row.rbi_repo_rate)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#6a7f79]" title={row.notes ?? undefined}>{row.verified_at ? "Official check" : "Manual entry"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
