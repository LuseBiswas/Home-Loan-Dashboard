"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { PiggyBank, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ContentLoading } from "@/components/loading-screen";
import { PrepaymentDialog } from "@/components/prepayment-dialog";
import { Segmented } from "@/components/repayment-breakdown";
import { useWorkspace } from "@/components/workspace";
import { groupByYear, isEmi, loanSchedule, ScheduleRevision, totalsOf, YearType } from "@/lib/amortization";
import { deletePrepayment, loadScheduleRevisions } from "@/lib/loan-service";
import { cn } from "@/lib/utils";

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

const shortDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(`${date}T00:00:00`));

function todayIso() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

// Keeps the last loaded revisions so returning to this tab renders instantly while it refreshes.
const revisionsCache = new Map<string, ScheduleRevision[]>();

export function SchedulePage() {
  const { loan } = useWorkspace();
  const loanId = loan.id;
  const [yearType, setYearType] = useState<YearType>("financial");
  const [revisions, setRevisions] = useState<{ loanId: string; items: ScheduleRevision[] } | null>(() => {
    const cached = revisionsCache.get(loan.id);
    return cached ? { loanId: loan.id, items: cached } : null;
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    loadScheduleRevisions(loanId)
      .then((items) => {
        if (!active) return;
        revisionsCache.set(loanId, items);
        setLoadError(null);
        setRevisions({ loanId, items });
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load your schedule.");
      });

    return () => {
      active = false;
    };
  }, [loanId, refreshIndex]);

  const reload = useCallback(() => setRefreshIndex((value) => value + 1), []);
  const ready = revisions?.loanId === loanId;
  const items = useMemo(() => (ready ? revisions.items : []), [ready, revisions]);
  const rate = Number(loan.current_interest_rate);
  const rows = useMemo(() => loanSchedule(loan, rate, items), [loan, rate, items]);
  const years = useMemo(() => groupByYear(rows, yearType), [rows, yearType]);
  const totals = totalsOf(rows);
  const today = todayIso();
  const emiRows = rows.filter(isEmi);
  const nextRow = rows.find((row) => row.dueDate >= today);
  const nextEmi = emiRows.find((row) => row.dueDate >= today);

  useEffect(() => {
    if (!ready || window.location.hash !== "#next") return;
    document.getElementById("next")?.scrollIntoView({ block: "center" });
  }, [ready]);

  const header = (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-medium text-[#587069]">Repayment schedule</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Every EMI, month by month.</h1>
      </div>
      {ready && rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Year type" value={yearType} onChange={setYearType} options={[{ value: "financial", label: "Financial year" }, { value: "calendar", label: "Calendar year" }]} />
          <PrepaymentDialog
            loan={loan}
            annualRate={rate}
            revisions={items}
            onSaved={reload}
            trigger={<Button className="bg-[#173d35] text-white hover:bg-[#0d2824]"><Plus className="size-4" />Record prepayment</Button>}
          />
        </div>
      ) : null}
    </div>
  );

  if (loadError) {
    return <>{header}<p className="mt-7 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">We couldn&apos;t load your schedule. {loadError}</p></>;
  }
  if (!ready) return <>{header}<ContentLoading label="Loading your schedule…" /></>;

  if (rows.length === 0) {
    return (
      <>
        {header}
        <Card className="mt-7 border-[#dce5e2] bg-white shadow-none">
          <CardContent className="px-6 py-10 text-center text-sm text-[#6a7f79]">Add your regular EMI start date in Profile to see your schedule.</CardContent>
        </Card>
      </>
    );
  }

  const revisionByRow = new Map<number, ScheduleRevision[]>();
  for (const revision of items) {
    const row = [...rows].reverse().find((candidate) => candidate.dueDate <= revision.effectiveDate);
    if (row) revisionByRow.set(row.number, [...(revisionByRow.get(row.number) ?? []), revision]);
  }

  return (
    <>
      {header}

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Monthly EMI" value={money(nextEmi?.emi ?? emiRows.at(-1)?.emi ?? 0)} note={`${emiRows.length} EMIs at ${rate.toFixed(2)}%`} />
        <Tile
          label="Next payment"
          value={nextRow ? shortDate(nextRow.dueDate) : "All paid"}
          note={!nextRow ? "Loan fully repaid" : nextRow.kind === "first_installment" ? `First installment · ${money(nextRow.emi)}` : `EMI ${nextRow.number} of ${emiRows.length}`}
        />
        <Tile label="Total interest" value={money(totals.interest)} note={totals.prepaid > 0 ? `After ${money(totals.prepaid)} prepaid` : `On ${money(totals.principal)} principal`} />
        <Tile label="Last EMI" value={shortDate(rows.at(-1)!.dueDate)} note={`Total paid ${money(totals.total)}`} />
      </div>

      <PrepaymentHistory revisions={items} onChanged={reload} />

      <Card className="mt-4 gap-0 border-[#dce5e2] bg-white py-0 shadow-none">
        <div className="overflow-x-auto md:overflow-visible">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-[#6a7f79]">
              <tr>
                {["EMI", "Due date", "Principal", "Interest", "EMI amount", "Balance after"].map((heading, index) => (
                  <th key={heading} className={cn("bg-[#f4f7f6] px-4 py-3 font-medium md:sticky md:top-[76px] md:z-10", index >= 2 && "text-right", index === 0 && "rounded-tl-xl", index === 5 && "rounded-tr-xl")}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {years.map((year) => (
                <Fragment key={year.key}>
                  <tr className="border-t border-[#dce5e2] bg-[#f3faf7]">
                    <td colSpan={2} className="px-4 py-2.5 font-semibold text-[#173d35]">{year.label}<span className="ml-2 text-xs font-normal text-[#6a7f79]">{year.emiCount} EMI{year.emiCount === 1 ? "" : "s"}{year.prepaid > 0 ? ` · ${money(year.prepaid)} prepaid` : ""}</span></td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#173d35]">{money(year.principal)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#173d35]">{money(year.interest)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#173d35]">{money(year.total)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-[#587069]">{money(year.closing)}</td>
                  </tr>
                  {year.rows.map((row) => {
                    const isNext = row === nextRow;
                    const isPast = row.dueDate < today;
                    return (
                      <Fragment key={row.number}>
                        <tr id={isNext ? "next" : undefined} className={cn("scroll-mt-32 border-t border-[#eef3f1]", isNext && "bg-[#ecfccb]", isPast && "text-[#789089]")}>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-2">
                              {row.kind === "first_installment" ? <span className="text-xs font-medium text-[#587069]">First</span> : row.number}
                              {isNext ? <span className="rounded-full bg-[#173d35] px-2 py-0.5 text-[0.65rem] font-semibold text-white">Next</span> : null}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {shortDate(row.dueDate)}
                            {row.kind === "first_installment" ? <span className="block text-[0.7rem] text-[#6a7f79]">Interest only · before regular EMIs</span> : null}
                          </td>
                          <td className="px-4 py-2 text-right">{money(row.principal)}</td>
                          <td className="px-4 py-2 text-right">{money(row.interest)}</td>
                          <td className={cn("px-4 py-2 text-right", !isPast && "font-medium text-[#10201d]")}>{money(row.emi)}</td>
                          <td className="px-4 py-2 text-right">{money(row.prepayment > 0 ? row.closing + row.prepayment : row.closing)}</td>
                        </tr>
                        {(revisionByRow.get(row.number) ?? []).map((revision) => (
                          <tr key={revision.paymentId} className="border-t border-[#eef3f1] bg-[#f3faf7] text-[#0f766e]">
                            <td className="px-4 py-2"><PiggyBank className="size-4" aria-hidden="true" /></td>
                            <td className="px-4 py-2 whitespace-nowrap font-medium">{shortDate(revision.effectiveDate)}</td>
                            <td className="px-4 py-2 text-right font-semibold">{money(revision.amount)}</td>
                            <td colSpan={2} className="px-4 py-2 text-right text-xs">Prepayment · {revision.reduce === "tenure" ? "tenure reduced" : `EMI now ${money(revision.emi)}`}</td>
                            <td className="px-4 py-2 text-right font-semibold">{money(revision.openingPrincipal)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs leading-5 text-[#6a7f79]">Estimated with the standard reducing-balance method at your current rate of {rate.toFixed(2)}%. If your rate is revised, future EMIs update automatically.</p>
    </>
  );
}

function PrepaymentHistory({ revisions, onChanged }: { revisions: ScheduleRevision[]; onChanged: () => void }) {
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (revisions.length === 0) return null;

  const latest = revisions.at(-1)!;
  const totalPrepaid = revisions.reduce((sum, revision) => sum + revision.amount, 0);

  async function undo() {
    setUndoing(true);
    setError(null);
    try {
      await deletePrepayment(latest.paymentId);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not undo the prepayment.");
    } finally {
      setUndoing(false);
    }
  }

  return (
    <Card id="prepayments" className="mt-4 scroll-mt-28 gap-0 border-[#dce5e2] bg-white py-0 shadow-none">
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Prepayments</p>
          <p className="text-sm text-[#587069]">{money(totalPrepaid)} prepaid in total</p>
        </div>
        <ul className="mt-3 divide-y divide-[#eef3f1]">
          {[...revisions].reverse().map((revision) => (
            <li key={revision.paymentId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#173d35]">{money(revision.amount)} <span className="font-normal text-[#587069]">on {shortDate(revision.effectiveDate)}</span></p>
                <p className="truncate text-xs text-[#6a7f79]">
                  {revision.reduce === "tenure" ? "Kept EMI, reduced tenure" : `Reduced EMI to ${money(revision.emi)}`}
                  {revision.transactionReference ? ` · Ref ${revision.transactionReference}` : ""}
                  {revision.notes ? ` · ${revision.notes}` : ""}
                </p>
              </div>
              {revision === latest ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={undoing} className="shrink-0"><Undo2 className="size-3.5" />Undo</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Undo this prepayment?</AlertDialogTitle>
                      <AlertDialogDescription>The {money(revision.amount)} prepayment on {shortDate(revision.effectiveDate)} will be deleted and your schedule will go back to how it was before it.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={undo}>Undo prepayment</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </li>
          ))}
        </ul>
        {revisions.length > 1 ? <p className="mt-1 text-xs text-[#6a7f79]">Only the most recent prepayment can be undone, so later schedules always stay consistent.</p> : null}
        {error ? <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="gap-0 border-[#dce5e2] bg-white py-4 shadow-none">
      <CardContent className="px-4">
        <p className="text-sm font-medium text-[#6a7f79]">{label}</p>
        <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{value}</p>
        <p className="mt-0.5 text-xs text-[#789089]">{note}</p>
      </CardContent>
    </Card>
  );
}
