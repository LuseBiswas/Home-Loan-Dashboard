"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  AmortizationRow, buildAmortization, crossoverRow, groupByYear, monthsOf, periodStartYear, PeriodSummary, totalsOf, YearType,
} from "@/lib/amortization";
import { cn } from "@/lib/utils";

// Validated for colour-blind separation and 3:1 contrast on white (dataviz palette check).
const PRINCIPAL = "#0d9488";
const INTEREST = "#eb6834";
const BALANCE = "#0f766e";

const chartConfig = {
  principal: { label: "Principal", color: PRINCIPAL },
  interest: { label: "Interest", color: INTEREST },
  closing: { label: "Outstanding", color: BALANCE },
} satisfies ChartConfig;

type Metric = "split" | "balance";
type View = "yearly" | "monthly";

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

function compactInr(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (abs >= 1_000) return `₹${Math.round(value / 1_000)}K`;
  return `₹${Math.round(value)}`;
}

const monthYear = (isoDate: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" })
  .format(new Date(`${isoDate}T00:00:00`));

function todayIso() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

type RepaymentBreakdownProps = {
  principal: number;
  annualRate: number;
  months: number;
  startDate: string | null;
  debitedEmi: number;
};

export function RepaymentBreakdown({ principal, annualRate, months, startDate, debitedEmi }: RepaymentBreakdownProps) {
  const [metric, setMetric] = useState<Metric>("split");
  const [view, setView] = useState<View>("yearly");
  const [yearType, setYearType] = useState<YearType>("financial");
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const rows = useMemo(
    () => (startDate ? buildAmortization({ principal, annualRate, months, startDate, debitedEmi }) : []),
    [principal, annualRate, months, startDate, debitedEmi],
  );
  const years = useMemo(() => groupByYear(rows, yearType), [rows, yearType]);

  if (!startDate || rows.length === 0) {
    return (
      <Card className="border-[#dce5e2] bg-white shadow-none">
        <CardContent className="px-6 py-10 text-center text-sm text-[#6a7f79]">Add your regular EMI start date to see the repayment breakdown.</CardContent>
      </Card>
    );
  }

  const today = todayIso();
  const todayYearKey = String(periodStartYear(today, yearType));
  const defaultYear = years.find((year) => year.key === todayYearKey) ?? (today < rows[0].dueDate ? years[0] : years.at(-1)!);
  const activeYear = years.find((year) => year.key === selectedYear) ?? defaultYear;
  const activeIndex = years.indexOf(activeYear);

  const points = view === "yearly" ? years : monthsOf(activeYear);
  const scope = view === "yearly" ? totalsOf(rows) : activeYear;
  const interestShare = scope.total > 0 ? (scope.interest / scope.total) * 100 : 0;
  const crossover = crossoverRow(rows);
  const nextDue = rows.find((row) => row.dueDate >= today);
  const todayPoint = view === "yearly"
    ? years.find((year) => year.key === todayYearKey)?.shortLabel
    : nextDue && activeYear.rows.includes(nextDue) ? points.find((point) => point.key === nextDue.dueDate)?.shortLabel : undefined;

  function drillInto(index: number) {
    if (view !== "yearly") return;
    const year = years[index];
    if (!year) return;
    setSelectedYear(year.key);
    setView("monthly");
  }

  function changeYearType(next: YearType) {
    setYearType(next);
    setSelectedYear(null);
  }

  return (
    <Card className="overflow-hidden border-[#dce5e2] bg-white shadow-[0_10px_30px_rgba(20,50,44,0.04)]">
      <CardHeader className="gap-4 px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold">Repayment breakdown</p>
            <p className="mt-1 text-sm text-[#6a7f79]">Estimated at {annualRate.toFixed(2)}% on {money(principal)} over {rows.length} EMIs</p>
          </div>
          <Segmented
            label="Chart"
            value={metric}
            onChange={setMetric}
            options={[{ value: "split", label: "Principal vs interest" }, { value: "balance", label: "Balance" }]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Period" value={view} onChange={setView} options={[{ value: "yearly", label: "Yearly" }, { value: "monthly", label: "Monthly" }]} />
          <Segmented label="Year type" value={yearType} onChange={changeYearType} options={[{ value: "financial", label: "Financial year" }, { value: "calendar", label: "Calendar year" }]} />
          {view === "monthly" ? (
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous year" disabled={activeIndex <= 0} onClick={() => setSelectedYear(years[activeIndex - 1].key)}><ChevronLeft /></Button>
              <select
                aria-label="Year"
                value={activeYear.key}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="h-8 rounded-md border border-[#dce5e2] bg-white px-2 text-sm font-medium text-[#173d35] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {years.map((year) => <option key={year.key} value={year.key}>{year.label}</option>)}
              </select>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next year" disabled={activeIndex >= years.length - 1} onClick={() => setSelectedYear(years[activeIndex + 1].key)}><ChevronRight /></Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-5 sm:px-5">
        <div className="grid grid-cols-2 gap-2 px-3 sm:grid-cols-4 sm:px-1">
          <SummaryTile label={view === "yearly" ? "Total you'll pay" : `Paid in ${activeYear.label}`} value={money(scope.total)} note={`${scope.emiCount} EMI${scope.emiCount === 1 ? "" : "s"}`} />
          <SummaryTile label="Principal" value={money(scope.principal)} note="Reduces your loan" swatch={PRINCIPAL} />
          <SummaryTile label="Interest" value={money(scope.interest)} note={`${interestShare.toFixed(0)}% of what you pay`} swatch={INTEREST} />
          <SummaryTile label={view === "yearly" ? "Balance at end" : `Balance after ${activeYear.label}`} value={money(scope.closing)} note={view === "yearly" ? "Fully repaid" : "Outstanding principal"} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-1">
          {metric === "split" ? (
            <div className="flex items-center gap-4 text-xs text-[#4f6761]" aria-label="Legend">
              <LegendItem color={PRINCIPAL} label="Principal" />
              <LegendItem color={INTEREST} label="Interest" />
            </div>
          ) : <p className="text-xs text-[#4f6761]">Outstanding principal at the end of each {view === "yearly" ? "year" : "month"}</p>}
          {view === "yearly" ? <p className="text-xs text-[#6a7f79]">Click a year to see its months</p> : null}
        </div>

        <ChartContainer config={chartConfig} className="mt-2 aspect-auto h-[280px] w-full">
          {metric === "split" ? (
            <BarChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke="#e8efed" />
              <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={14} />
              <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={compactInr} />
              <ChartTooltip cursor={{ fill: "#f1f6f4" }} content={<BreakdownTooltip view={view} />} />
              {todayPoint ? <ReferenceLine x={todayPoint} stroke="#587069" strokeDasharray="4 4" label={{ value: "Now", position: "insideTopRight", fill: "#587069", fontSize: 11 }} /> : null}
              <Bar dataKey="principal" stackId="emi" fill={PRINCIPAL} stroke="#ffffff" strokeWidth={2} maxBarSize={24} className={view === "yearly" ? "cursor-pointer" : undefined} onClick={(_, index) => drillInto(index)} />
              <Bar dataKey="interest" stackId="emi" fill={INTEREST} stroke="#ffffff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={24} className={view === "yearly" ? "cursor-pointer" : undefined} onClick={(_, index) => drillInto(index)} />
            </BarChart>
          ) : (
            <AreaChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }} onClick={(state) => typeof state?.activeTooltipIndex === "number" ? drillInto(state.activeTooltipIndex) : undefined} className={view === "yearly" ? "cursor-pointer" : undefined}>
              <defs><linearGradient id="breakdownBalanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BALANCE} stopOpacity={0.22} /><stop offset="100%" stopColor={BALANCE} stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#e8efed" />
              <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={14} />
              <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={compactInr} />
              <ChartTooltip cursor={{ stroke: "#9fb8b2", strokeDasharray: "4 4" }} content={<BreakdownTooltip view={view} />} />
              {todayPoint ? <ReferenceLine x={todayPoint} stroke="#587069" strokeDasharray="4 4" label={{ value: "Now", position: "insideTopRight", fill: "#587069", fontSize: 11 }} /> : null}
              <Area type="monotone" dataKey="closing" stroke={BALANCE} strokeWidth={2} fill="url(#breakdownBalanceFill)" activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }} />
            </AreaChart>
          )}
        </ChartContainer>

        <div className="mt-4 flex flex-col gap-3 border-t border-[#e5ece9] px-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-1">
          <p className="text-xs leading-5 text-[#6a7f79]">
            {crossover ? <>From <span className="font-semibold text-[#173d35]">{monthYear(crossover.dueDate)}</span>, more of each EMI goes to principal than interest. </> : null}
            Uses today&apos;s rate for every month, so figures change if your rate is revised.
          </p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" aria-expanded={showTable} onClick={() => setShowTable((value) => !value)}>
            <Table2 className="size-3.5" />{showTable ? "Hide table" : "Show table"}
          </Button>
        </div>

        {showTable ? <BreakdownTable points={points} view={view} /> : null}
      </CardContent>
    </Card>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-[#e8efed] p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition",
              active ? "bg-white text-[#173d35] shadow-sm" : "text-[#587069] hover:text-[#173d35]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryTile({ label, value, note, swatch }: { label: string; value: string; note: string; swatch?: string }) {
  return (
    <div className="rounded-xl bg-[#f4f7f6] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[0.7rem] text-[#6a7f79]">
        {swatch ? <span className="size-2 rounded-full" style={{ backgroundColor: swatch }} aria-hidden="true" /> : null}{label}
      </p>
      <p className="mt-0.5 text-base font-semibold tracking-tight text-[#10201d]">{value}</p>
      <p className="text-[0.7rem] text-[#6a7f79]">{note}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />{label}</span>;
}

type TooltipPayload = { payload?: PeriodSummary };

function BreakdownTooltip({ active, payload, view }: { active?: boolean; payload?: TooltipPayload[]; view: View }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div className="min-w-44 rounded-lg border border-[#dce5e2] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[#10201d]">{point.label}{view === "yearly" ? <span className="font-normal text-[#6a7f79]"> · {point.emiCount} EMI{point.emiCount === 1 ? "" : "s"}</span> : null}</p>
      <div className="mt-1.5 space-y-1">
        <TooltipRow color={PRINCIPAL} label="Principal" value={money(point.principal)} />
        <TooltipRow color={INTEREST} label="Interest" value={money(point.interest)} />
        <div className="flex justify-between gap-4 border-t border-[#eef3f1] pt-1 font-semibold text-[#10201d]"><span>{view === "yearly" ? "Total paid" : "EMI"}</span><span>{money(point.total)}</span></div>
        <div className="flex justify-between gap-4 text-[#6a7f79]"><span>Balance after</span><span className="font-medium text-[#173d35]">{money(point.closing)}</span></div>
      </div>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[#4f6761]">
      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />{label}</span>
      <span className="font-medium text-[#10201d]">{value}</span>
    </div>
  );
}

function BreakdownTable({ points, view }: { points: PeriodSummary[]; view: View }) {
  const firstRow = (point: PeriodSummary): AmortizationRow | undefined => point.rows[0];
  return (
    <div className="mx-3 mt-4 max-h-80 overflow-auto rounded-xl border border-[#e5ece9] sm:mx-1">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="sticky top-0 bg-[#f4f7f6] text-xs text-[#6a7f79]">
          <tr>
            <th className="px-3 py-2.5 font-medium">{view === "yearly" ? "Year" : "Month"}</th>
            <th className="px-3 py-2.5 font-medium">{view === "yearly" ? "EMIs" : "EMI no."}</th>
            <th className="px-3 py-2.5 text-right font-medium">Principal</th>
            <th className="px-3 py-2.5 text-right font-medium">Interest</th>
            <th className="px-3 py-2.5 text-right font-medium">{view === "yearly" ? "Total paid" : "EMI"}</th>
            <th className="px-3 py-2.5 text-right font-medium">Balance after</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {points.map((point) => (
            <tr key={point.key} className="border-t border-[#eef3f1]">
              <td className="px-3 py-2 font-medium whitespace-nowrap">{point.label}</td>
              <td className="px-3 py-2 text-[#587069]">{view === "yearly" ? point.emiCount : firstRow(point)?.number}</td>
              <td className="px-3 py-2 text-right">{money(point.principal)}</td>
              <td className="px-3 py-2 text-right">{money(point.interest)}</td>
              <td className="px-3 py-2 text-right font-semibold">{money(point.total)}</td>
              <td className="px-3 py-2 text-right text-[#587069]">{money(point.closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
