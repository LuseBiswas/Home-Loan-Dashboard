"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/repayment-breakdown";
import { useWorkspace } from "@/components/workspace";
import { groupByYear, loanSchedule, totalsOf, YearType } from "@/lib/amortization";
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

export function SchedulePage() {
  const { loan } = useWorkspace();
  const [yearType, setYearType] = useState<YearType>("financial");
  const rate = Number(loan.current_interest_rate);
  const rows = useMemo(() => loanSchedule(loan, rate), [loan, rate]);
  const years = useMemo(() => groupByYear(rows, yearType), [rows, yearType]);
  const totals = totalsOf(rows);
  const today = todayIso();
  const nextRow = rows.find((row) => row.dueDate >= today);

  useEffect(() => {
    if (window.location.hash !== "#next") return;
    document.getElementById("next")?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#587069]">Repayment schedule</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Every EMI, month by month.</h1>
        </div>
        <Segmented label="Year type" value={yearType} onChange={setYearType} options={[{ value: "financial", label: "Financial year" }, { value: "calendar", label: "Calendar year" }]} />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-7 border-[#dce5e2] bg-white shadow-none">
          <CardContent className="px-6 py-10 text-center text-sm text-[#6a7f79]">Add your regular EMI start date in Profile to see your schedule.</CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Monthly EMI" value={money(Number(loan.regular_emi_amount))} note={`${rows.length} EMIs at ${rate.toFixed(2)}%`} />
            <Tile label="Next EMI" value={nextRow ? shortDate(nextRow.dueDate) : "All paid"} note={nextRow ? `EMI ${nextRow.number} of ${rows.length}` : "Loan fully repaid"} />
            <Tile label="Total interest" value={money(totals.interest)} note={`On ${money(totals.principal)} principal`} />
            <Tile label="Last EMI" value={shortDate(rows.at(-1)!.dueDate)} note={`Total paid ${money(totals.total)}`} />
          </div>

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
                        <td colSpan={2} className="px-4 py-2.5 font-semibold text-[#173d35]">{year.label}<span className="ml-2 text-xs font-normal text-[#6a7f79]">{year.emiCount} EMI{year.emiCount === 1 ? "" : "s"}</span></td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#173d35]">{money(year.principal)}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#173d35]">{money(year.interest)}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#173d35]">{money(year.total)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-[#587069]">{money(year.closing)}</td>
                      </tr>
                      {year.rows.map((row) => {
                        const isNext = row === nextRow;
                        const isPast = row.dueDate < today;
                        return (
                          <tr
                            key={row.number}
                            id={isNext ? "next" : undefined}
                            className={cn("scroll-mt-32 border-t border-[#eef3f1]", isNext && "bg-[#ecfccb]", isPast && "text-[#789089]")}
                          >
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-2">
                                {row.number}
                                {isNext ? <span className="rounded-full bg-[#173d35] px-2 py-0.5 text-[0.65rem] font-semibold text-white">Next</span> : null}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{shortDate(row.dueDate)}</td>
                            <td className="px-4 py-2 text-right">{money(row.principal)}</td>
                            <td className="px-4 py-2 text-right">{money(row.interest)}</td>
                            <td className={cn("px-4 py-2 text-right", !isPast && "font-medium text-[#10201d]")}>{money(row.emi)}</td>
                            <td className="px-4 py-2 text-right">{money(row.closing)}</td>
                          </tr>
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
      )}
    </>
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
