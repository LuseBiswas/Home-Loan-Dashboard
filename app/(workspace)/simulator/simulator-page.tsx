"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Info, Landmark, Percent, Repeat, Sparkles, Table2, TrendingUp, Wallet } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ContentLoading } from "@/components/loading-screen";
import { PrepaymentDialog } from "@/components/prepayment-dialog";
import { Segmented } from "@/components/repayment-breakdown";
import { useWorkspace } from "@/components/workspace";
import { addMonthsIso, AmortizationRow, isEmi, loanSchedule, periodLabel, periodStartYear, ReduceOption } from "@/lib/amortization";
import { Scenario, simulate, SimulationResult } from "@/lib/simulator";
import { useScheduleRevisions } from "@/lib/use-schedule-revisions";
import { cn } from "@/lib/utils";

const CURRENT = "#8a9a95";
const SCENARIO = "#0d9488";

const chartConfig = {
  current: { label: "Current plan", color: CURRENT },
  scenario: { label: "With scenario", color: SCENARIO },
} satisfies ChartConfig;

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

function duration(months: number) {
  const years = Math.floor(Math.abs(months) / 12);
  const rest = Math.abs(months) % 12;
  const parts = [years ? `${years} yr${years === 1 ? "" : "s"}` : "", rest ? `${rest} mo${rest === 1 ? "" : "s"}` : ""].filter(Boolean);
  return parts.join(" ") || "0 mos";
}

type Toggle<T> = { enabled: boolean } & T;
type FormState = {
  reduce: ReduceOption;
  lump: Toggle<{ amount: string; date: string }>;
  recurring: Toggle<{ amount: string; frequency: "monthly" | "yearly"; startDate: string }>;
  stepUp: Toggle<{ percent: string; startDate: string }>;
  rateChange: Toggle<{ rate: string; fromDate: string }>;
};

function defaults(nextEmiDate: string, emi: number, rate: number): FormState {
  return {
    reduce: "tenure",
    lump: { enabled: false, amount: "100000", date: nextEmiDate },
    recurring: { enabled: false, amount: String(emi), frequency: "yearly", startDate: nextEmiDate },
    stepUp: { enabled: false, percent: "5", startDate: addMonthsIso(nextEmiDate, 12) },
    rateChange: { enabled: false, rate: (rate + 0.5).toFixed(2), fromDate: nextEmiDate },
  };
}

const positive = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

function toScenario(form: FormState): Scenario {
  const rate = Number(form.rateChange.rate);
  return {
    reduce: form.reduce,
    lumpSums: form.lump.enabled && positive(form.lump.amount) && form.lump.date ? [{ amount: positive(form.lump.amount), date: form.lump.date }] : [],
    recurring: form.recurring.enabled && positive(form.recurring.amount) && form.recurring.startDate
      ? { amount: positive(form.recurring.amount), frequency: form.recurring.frequency, startDate: form.recurring.startDate }
      : null,
    stepUp: form.stepUp.enabled && positive(form.stepUp.percent) && form.stepUp.startDate
      ? { percent: Math.min(positive(form.stepUp.percent), 50), startDate: form.stepUp.startDate }
      : null,
    rateChange: form.rateChange.enabled && Number.isFinite(rate) && rate >= 0 && rate < 30 && form.rateChange.fromDate
      ? { rate, fromDate: form.rateChange.fromDate }
      : null,
  };
}

export function SimulatorPage() {
  const { loan } = useWorkspace();
  const { revisions, ready, error, reload } = useScheduleRevisions(loan.id);
  const rate = Number(loan.current_interest_rate);
  const baseline = useMemo(() => loanSchedule(loan, rate, revisions), [loan, rate, revisions]);
  const today = todayIso();
  const nextEmi = baseline.find((row) => isEmi(row) && row.dueDate >= today);

  const header = (
    <div>
      <p className="text-sm font-medium text-[#587069]">Prepayment simulator</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Test a what-if before you pay.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6a7f79]">Try lump sums, regular extra payments, EMI increases or a rate change. Nothing here is saved to your loan.</p>
    </div>
  );

  if (error) return <>{header}<p className="mt-7 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">We couldn&apos;t load your schedule. {error}</p></>;
  if (!ready) return <>{header}<ContentLoading label="Loading your schedule…" /></>;
  if (!loan.regular_emi_start_date || !nextEmi) {
    return (
      <>
        {header}
        <Card className="mt-7 border-[#dce5e2] bg-white shadow-none">
          <CardContent className="px-6 py-10 text-center text-sm text-[#6a7f79]">{!loan.regular_emi_start_date ? "Add your EMI start date in Profile to use the simulator." : "Your loan has no EMIs left to simulate."}</CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <Simulator
        key={nextEmi.dueDate}
        baseline={baseline}
        emiStartDate={loan.regular_emi_start_date}
        nextEmiDate={nextEmi.dueDate}
        currentEmi={nextEmi.emi}
        rate={rate}
        recordPrepayment={(initial) => (
          <PrepaymentDialog
            loan={loan}
            annualRate={rate}
            revisions={revisions}
            onSaved={reload}
            initial={initial}
            trigger={<Button type="button" variant="outline" size="sm" className="w-full border-[#bfd8cf] text-[#173d35]">Already paid it? Record this prepayment</Button>}
          />
        )}
      />
    </>
  );
}

type SimulatorProps = {
  baseline: AmortizationRow[];
  emiStartDate: string;
  nextEmiDate: string;
  currentEmi: number;
  rate: number;
  recordPrepayment: (initial: { amount: number; date: string; reduce: ReduceOption }) => React.ReactNode;
};

function Simulator({ baseline, emiStartDate, nextEmiDate, currentEmi, rate, recordPrepayment }: SimulatorProps) {
  const today = todayIso();
  const minDate = today > nextEmiDate ? today : nextEmiDate;
  const [form, setForm] = useState<FormState>(() => defaults(nextEmiDate, currentEmi, rate));
  const [showTable, setShowTable] = useState(false);

  const scenario = useMemo(() => toScenario(form), [form]);
  const active = scenario.lumpSums.length > 0 || scenario.recurring !== null || scenario.stepUp !== null || scenario.rateChange !== null;
  const result = useMemo(
    () => simulate({ baseline, annualRate: rate, emiStartDate, fromDate: today, scenario }),
    [baseline, rate, emiStartDate, today, scenario],
  );

  function update<K extends keyof FormState>(key: K, patch: Partial<FormState[K]>) {
    setForm((current) => ({ ...current, [key]: typeof current[key] === "object" ? { ...(current[key] as object), ...patch } : patch }));
  }

  function applyPreset(preset: "extra-emi" | "step-up" | "lump" | "rate") {
    const base = defaults(nextEmiDate, currentEmi, rate);
    setForm({
      ...base,
      reduce: form.reduce,
      recurring: { ...base.recurring, enabled: preset === "extra-emi" },
      stepUp: { ...base.stepUp, enabled: preset === "step-up" },
      lump: { ...base.lump, enabled: preset === "lump" },
      rateChange: { ...base.rateChange, enabled: preset === "rate" },
    });
  }

  const onlyLump = scenario.lumpSums.length === 1 && !scenario.recurring && !scenario.stepUp && !scenario.rateChange;
  const canRecord = onlyLump && scenario.lumpSums[0].date <= today;

  return (
    <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)] lg:items-start">
      <div className="min-w-0 space-y-4">
        <Card className="gap-0 border-[#dce5e2] bg-white py-0 shadow-none">
          <CardContent className="space-y-4 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Quick start</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PresetButton onClick={() => applyPreset("extra-emi")}>1 extra EMI every year</PresetButton>
                <PresetButton onClick={() => applyPreset("step-up")}>Raise EMI 5% a year</PresetButton>
                <PresetButton onClick={() => applyPreset("lump")}>₹1 lakh lump sum</PresetButton>
                <PresetButton onClick={() => applyPreset("rate")}>Rate rises 0.5%</PresetButton>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-[#e5ece9] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">After each extra payment</p>
                <p className="text-xs text-[#6a7f79]">Reducing tenure usually saves far more interest.</p>
              </div>
              <Segmented label="After each extra payment" value={form.reduce} onChange={(reduce) => setForm((current) => ({ ...current, reduce }))} options={[{ value: "tenure", label: "Reduce tenure" }, { value: "emi", label: "Reduce EMI" }]} />
            </div>
          </CardContent>
        </Card>

        <ScenarioCard icon={Wallet} title="One-time lump sum" description="A bonus, maturity or gift paid towards principal." enabled={form.lump.enabled} onToggle={(enabled) => update("lump", { enabled })}>
          <Field label="Amount (₹)"><Input type="number" min="1" step="1" value={form.lump.amount} onChange={(event) => update("lump", { amount: event.target.value })} /></Field>
          <Field label="Paid on"><Input type="date" min={minDate} value={form.lump.date} onChange={(event) => update("lump", { date: event.target.value })} /></Field>
        </ScenarioCard>

        <ScenarioCard icon={Repeat} title="Regular extra payment" description="A fixed top-up every month or every year." enabled={form.recurring.enabled} onToggle={(enabled) => update("recurring", { enabled })}>
          <Field label="Amount (₹)">
            <Input type="number" min="1" step="1" value={form.recurring.amount} onChange={(event) => update("recurring", { amount: event.target.value })} />
          </Field>
          <Field label="How often">
            <Segmented label="How often" value={form.recurring.frequency} onChange={(frequency) => update("recurring", { frequency })} options={[{ value: "monthly", label: "Every month" }, { value: "yearly", label: "Every year" }]} />
          </Field>
          <Field label="Starting"><Input type="date" min={minDate} value={form.recurring.startDate} onChange={(event) => update("recurring", { startDate: event.target.value })} /></Field>
        </ScenarioCard>

        <ScenarioCard icon={TrendingUp} title="EMI step-up" description="Raise your EMI by a fixed percentage every year, e.g. with salary increments." enabled={form.stepUp.enabled} onToggle={(enabled) => update("stepUp", { enabled })}>
          <Field label="Increase each year (%)"><Input type="number" min="0.1" max="50" step="0.1" value={form.stepUp.percent} onChange={(event) => update("stepUp", { percent: event.target.value })} /></Field>
          <Field label="First increase from"><Input type="date" min={minDate} value={form.stepUp.startDate} onChange={(event) => update("stepUp", { startDate: event.target.value })} /></Field>
        </ScenarioCard>

        <ScenarioCard icon={Percent} title="Rate change" description={`Your floating rate is ${rate.toFixed(2)}% today. See what a revision would do.`} enabled={form.rateChange.enabled} onToggle={(enabled) => update("rateChange", { enabled })}>
          <Field label="New rate (%)"><Input type="number" min="0" max="30" step="0.05" value={form.rateChange.rate} onChange={(event) => update("rateChange", { rate: event.target.value })} /></Field>
          <Field label="From"><Input type="date" min={minDate} value={form.rateChange.fromDate} onChange={(event) => update("rateChange", { fromDate: event.target.value })} /></Field>
        </ScenarioCard>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-[100px]">
        <Results result={result} active={active} scenario={scenario} currentEmi={currentEmi} footer={canRecord ? recordPrepayment({ amount: scenario.lumpSums[0].amount, date: scenario.lumpSums[0].date, reduce: scenario.reduce }) : null} />
        {result && active ? <ComparisonChart baseline={baseline} result={result} /> : null}
      </div>

      {result && active ? (
        <div className="lg:col-span-2">
          <Button type="button" variant="outline" size="sm" aria-expanded={showTable} onClick={() => setShowTable((value) => !value)}>
            <Table2 className="size-3.5" />{showTable ? "Hide yearly comparison" : "Show yearly comparison"}
          </Button>
          {showTable ? <YearlyComparison baseline={baseline} result={result} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-full border border-[#cfe1dc] bg-[#f3faf7] px-3 py-1.5 text-xs font-semibold text-[#173d35] transition hover:border-[#0f766e] hover:bg-[#e2f3ec]">
      <Sparkles className="mr-1 inline size-3 text-[#0f766e]" aria-hidden="true" />{children}
    </button>
  );
}

function ScenarioCard({ icon: Icon, title, description, enabled, onToggle, children }: { icon: typeof Wallet; title: string; description: string; enabled: boolean; onToggle: (enabled: boolean) => void; children: React.ReactNode }) {
  const id = `scenario-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Card className={cn("gap-0 border-[#dce5e2] bg-white py-0 shadow-none transition", enabled && "border-[#9fd3c5] ring-1 ring-[#cfe9e1]")}>
      <CardContent className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", enabled ? "bg-[#d9f99d] text-[#173d35]" : "bg-[#edf6f3] text-[#0f766e]")}><Icon className="size-5" /></div>
            <div>
              <label htmlFor={id} className="cursor-pointer font-semibold">{title}</label>
              <p className="mt-0.5 text-sm leading-6 text-[#6a7f79]">{description}</p>
            </div>
          </div>
          <Switch id={id} checked={enabled} onCheckedChange={onToggle} className="mt-1 cursor-pointer data-[state=checked]:bg-[#0f766e]" />
        </div>
        {enabled ? <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:[&>*:nth-child(3)]:col-span-2">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium"><span className="block">{label}</span>{children}</label>;
}

function Results({ result, active, scenario, currentEmi, footer }: { result: SimulationResult | null; active: boolean; scenario: Scenario; currentEmi: number; footer: React.ReactNode }) {
  if (!active || !result) {
    return (
      <Card className="border-[#dce5e2] bg-[#102f2a] text-white shadow-none">
        <CardContent className="px-6">
          <div className="grid size-10 place-items-center rounded-xl bg-white/10"><Landmark className="size-5 text-[#d9f99d]" /></div>
          <p className="mt-5 text-lg font-semibold">Pick a scenario to see its effect</p>
          <p className="mt-2 text-sm leading-6 text-[#c6d9d4]">Use a quick start or switch on any option on the left. Results update as you type.</p>
        </CardContent>
      </Card>
    );
  }

  const saves = result.interestSaved >= 0;
  const endsEarlier = result.emisSaved > 0;
  // Step-ups (and forced rises on a rate hike) push the EMI up, so show the highest; otherwise
  // show where the EMI ends up, e.g. after "reduce EMI" prepayments or a rate change.
  const finalEmi = result.scenario.lastEmi ?? currentEmi;
  const emiStat = scenario.stepUp
    ? { label: "Highest EMI", value: result.peakEmi ?? currentEmi }
    : Math.abs(finalEmi - currentEmi) < 1
      ? { label: "EMI", value: currentEmi }
      : { label: finalEmi < currentEmi ? "EMI falls to" : "EMI rises to", value: finalEmi };
  const forcedEmiRise = scenario.rateChange && scenario.reduce === "tenure" && (result.peakEmi ?? 0) > currentEmi + 1 && !scenario.stepUp;

  return (
    <Card className="border-[#dce5e2] bg-[#102f2a] text-white shadow-none">
      <CardContent className="px-6">
        <p className="text-sm text-[#9ec0b8]">{saves ? "You save in interest" : "Extra interest you'd pay"}</p>
        <p className={cn("mt-1 text-4xl font-semibold tracking-[-0.04em]", saves ? "text-[#d9f99d]" : "text-[#fdba74]")}>{money(Math.abs(result.interestSaved))}</p>
        <p className="mt-2 text-sm text-[#c6d9d4]">
          {result.emisSaved === 0
            ? `Loan still ends ${result.scenario.lastDate ? monthYear(result.scenario.lastDate) : "on time"}.`
            : `Loan ends ${duration(result.emisSaved)} ${endsEarlier ? "earlier" : "later"}: ${result.scenario.lastDate ? monthYear(result.scenario.lastDate) : "—"} instead of ${result.current.lastDate ? monthYear(result.current.lastDate) : "—"}.`}
        </p>

        <div className="my-5 h-px bg-white/10" />

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="EMIs left" value={`${result.scenario.emisLeft}`} note={`was ${result.current.emisLeft}`} />
          <Stat label={emiStat.label} value={money(emiStat.value)} note={`today ${money(currentEmi)}`} />
          <Stat label="Total interest" value={money(result.scenario.interest)} note={`was ${money(result.current.interest)}`} />
          <Stat label="Total you pay" value={money(result.scenario.paid)} note={result.extraPaid > 0 ? `incl. ${money(result.extraPaid)} extra` : `was ${money(result.current.paid)}`} />
        </div>

        {forcedEmiRise ? (
          <p className="mt-4 flex gap-2 rounded-xl bg-white/6 p-3 text-xs leading-5 text-[#c6d9d4]">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[#fdba74]" />At {scenario.rateChange!.rate.toFixed(2)}% your current EMI no longer covers the monthly interest, so the lender would have to raise it.
          </p>
        ) : null}
        <p className="mt-4 flex gap-2 text-xs leading-5 text-[#9ec0b8]"><CalendarClock className="mt-0.5 size-3.5 shrink-0" />Estimates from your next EMI onwards at {scenario.rateChange ? "the rates above" : "today's rate"}. Extra payments apply right after the EMI before them.</p>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white/6 px-3 py-2.5">
      <p className="text-[0.7rem] text-[#9ec0b8]">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
      <p className="text-[0.7rem] text-[#9ec0b8]">{note}</p>
    </div>
  );
}

type YearPoint = { key: string; label: string; shortLabel: string; current: number | null; scenario: number | null; currentInterest: number; scenarioInterest: number };

// Year-end balances and yearly interest for both plans, by financial year.
function yearlyPoints(baseline: AmortizationRow[], result: SimulationResult): YearPoint[] {
  const points = new Map<number, YearPoint>();
  const ensure = (year: number) => {
    let point = points.get(year);
    if (!point) {
      point = { key: String(year), label: periodLabel(year, "financial"), shortLabel: `${String(year % 100).padStart(2, "0")}–${String((year + 1) % 100).padStart(2, "0")}`, current: null, scenario: null, currentInterest: 0, scenarioInterest: 0 };
      points.set(year, point);
    }
    return point;
  };
  for (const row of baseline) {
    const point = ensure(periodStartYear(row.dueDate, "financial"));
    point.current = row.closing;
    point.currentInterest += row.exactInterest;
  }
  for (const row of result.rows) {
    const point = ensure(periodStartYear(row.dueDate, "financial"));
    point.scenario = row.closing;
    point.scenarioInterest += row.exactInterest;
  }
  const ordered = [...points.entries()].sort(([a], [b]) => a - b).map(([, point]) => point);
  // Once a plan is repaid its balance stays at zero, so both lines span the full chart.
  let currentDone = false;
  let scenarioDone = false;
  for (const point of ordered) {
    if (point.current === null) point.current = currentDone ? 0 : point.current;
    if (point.scenario === null) point.scenario = scenarioDone ? 0 : point.scenario;
    if (point.current === 0) currentDone = true;
    if (point.scenario === 0) scenarioDone = true;
  }
  return ordered;
}

function ComparisonChart({ baseline, result }: { baseline: AmortizationRow[]; result: SimulationResult }) {
  const points = useMemo(() => yearlyPoints(baseline, result), [baseline, result]);
  return (
    <Card className="gap-0 border-[#dce5e2] bg-white py-0 shadow-none">
      <CardContent className="px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-sm font-semibold">Outstanding balance</p>
          <div className="flex items-center gap-4 text-xs text-[#4f6761]" aria-label="Legend">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: CURRENT }} aria-hidden="true" />Current plan</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: SCENARIO }} aria-hidden="true" />With scenario</span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-[220px] w-full">
          <LineChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e8efed" />
            <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={14} />
            <YAxis axisLine={false} tickLine={false} width={48} tickFormatter={compactInr} />
            <ChartTooltip cursor={{ stroke: "#9fb8b2", strokeDasharray: "4 4" }} content={<ComparisonTooltip />} />
            <Line type="monotone" dataKey="current" stroke={CURRENT} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="scenario" stroke={SCENARIO} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ComparisonTooltip({ active, payload }: { active?: boolean; payload?: { payload?: YearPoint }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="min-w-44 rounded-lg border border-[#dce5e2] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[#10201d]">{point.label} · balance at year end</p>
      <div className="mt-1.5 space-y-1 text-[#4f6761]">
        <div className="flex justify-between gap-4"><span>Current plan</span><span className="font-medium text-[#10201d]">{money(point.current ?? 0)}</span></div>
        <div className="flex justify-between gap-4"><span>With scenario</span><span className="font-medium text-[#10201d]">{money(point.scenario ?? 0)}</span></div>
      </div>
    </div>
  );
}

function YearlyComparison({ baseline, result }: { baseline: AmortizationRow[]; result: SimulationResult }) {
  const points = useMemo(() => yearlyPoints(baseline, result), [baseline, result]);
  return (
    <Card className="mt-3 gap-0 border-[#dce5e2] bg-white py-0 shadow-none">
      <div className="max-h-96 overflow-auto rounded-xl">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="sticky top-0 bg-[#f4f7f6] text-xs text-[#6a7f79]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Year</th>
              <th className="px-4 py-2.5 text-right font-medium">Interest now</th>
              <th className="px-4 py-2.5 text-right font-medium">Interest with scenario</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance now</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance with scenario</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {points.map((point) => (
              <tr key={point.key} className="border-t border-[#eef3f1]">
                <td className="px-4 py-2 font-medium whitespace-nowrap">{point.label}</td>
                <td className="px-4 py-2 text-right text-[#587069]">{money(point.currentInterest)}</td>
                <td className="px-4 py-2 text-right font-semibold">{money(point.scenarioInterest)}</td>
                <td className="px-4 py-2 text-right text-[#587069]">{money(point.current ?? 0)}</td>
                <td className="px-4 py-2 text-right font-semibold">{money(point.scenario ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
