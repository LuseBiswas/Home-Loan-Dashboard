"use client";

import {
  ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight,
  FileText, IndianRupee, Percent, Sparkles, TrendingDown, WalletCards,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RateWatchStrip } from "@/components/rate-watch-strip";
import type { DashboardData } from "@/lib/loan-service";

const chartConfig = {
  balance: { label: "Outstanding", color: "#0f766e" },
} satisfies ChartConfig;

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

const displayDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
}).format(new Date(`${date}T00:00:00`));

const shortDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(`${date}T00:00:00`));

function calculateBalanceData(principal: number, annualRate: number, emi: number, months: number, startYear: number) {
  const monthlyRate = annualRate / 1200;
  let balance = principal;
  const points = [{ year: String(startYear), balance: Number((balance / 100_000).toFixed(1)) }];

  for (let month = 1; month <= months; month += 1) {
    balance = Math.max(0, balance * (1 + monthlyRate) - emi);
    if (month % 60 === 0 || month === months) {
      points.push({
        year: String(startYear + Math.ceil(month / 12)),
        balance: Number((balance / 100_000).toFixed(1)),
      });
    }
  }

  return points;
}

export function LoanDashboard({ data, rateRefreshing, rateRefreshError, onRefreshRates }: { data: DashboardData; rateRefreshing: boolean; rateRefreshError: string | null; onRefreshRates: () => void }) {
  const { loan, installments, latestRate, previousRate, payments } = data;
  const now = new Date();
  const upcomingInstallment = installments.find((item) => new Date(`${item.due_date}T23:59:59`) >= now);
  const firstInstallment = installments.find((item) => item.installment_type === "first_installment");
  const regularInstallment = installments.find((item) => item.installment_type === "regular_emi");
  const principalPaid = payments.reduce((total, payment) => total + Number(payment.principal_component ?? 0), 0);
  const outstandingPrincipal = Math.max(0, Number(loan.total_financed_amount) - principalPaid);
  const repaidPercent = Number(loan.total_financed_amount) > 0
    ? (principalPaid / Number(loan.total_financed_amount)) * 100
    : 0;
  const rate = Number(latestRate?.actual_applied_rate ?? loan.current_interest_rate);
  const daysUntilDue = upcomingInstallment
    ? Math.max(0, Math.ceil((new Date(`${upcomingInstallment.due_date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000))
    : 0;
  const scheduleStartDate = loan.regular_emi_start_date ?? loan.first_installment_date;
  const chartStartYear = scheduleStartDate
    ? new Date(`${scheduleStartDate}T00:00:00`).getFullYear()
    : now.getFullYear();
  const balanceData = calculateBalanceData(
    outstandingPrincipal,
    rate,
    Number(loan.regular_emi_amount),
    loan.original_tenure_months,
    chartStartYear,
  );
  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(now);
  const scheduleViewLabel = loan.original_tenure_months % 12 === 0
    ? `${loan.original_tenure_months / 12}-year view`
    : `${loan.original_tenure_months}-month view`;

  return (
    <>
      <RateWatchStrip
        benchmarkName={loan.benchmark_name}
        spread={loan.benchmark_spread_percent === null ? null : Number(loan.benchmark_spread_percent)}
        latest={latestRate}
        previous={previousRate}
        refreshing={rateRefreshing}
        refreshError={rateRefreshError}
        onRefresh={onRefreshRates}
      />

      <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#587069]">{todayLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Your loan, clearly mapped.</h1>
        </div>
        <Tabs defaultValue="contractual" className="w-full sm:w-auto">
          <TabsList className="w-full bg-[#e8efed] sm:w-auto">
            <TabsTrigger value="contractual">Contractual</TabsTrigger>
            <TabsTrigger value="actual">Actual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Outstanding principal" value={money(outstandingPrincipal)} note={principalPaid > 0 ? `${money(principalPaid)} principal repaid` : "Before first scheduled EMI"} icon={IndianRupee} />
        <MetricCard label="Regular EMI" value={money(Number(loan.regular_emi_amount))} note={loan.regular_emi_start_date ? `Starts ${shortDate(loan.regular_emi_start_date)}` : "Start date unavailable"} icon={WalletCards} />
        <MetricCard label="Current interest rate" value={`${rate.toFixed(2)}%`} note={`${loan.interest_type === "floating" ? "Floating" : loan.interest_type} · ${loan.benchmark_name ?? "Benchmark unavailable"}${loan.benchmark_spread_percent !== null ? ` ${Number(loan.benchmark_spread_percent) >= 0 ? "+" : "−"} ${Math.abs(Number(loan.benchmark_spread_percent)).toFixed(2)}%` : ""}`} icon={Percent} />
        <MetricCard label="Original tenure" value={`${loan.original_tenure_months} months`} note="Schedule revisions are versioned" icon={CalendarDays} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden border-[#dce5e2] bg-white shadow-[0_10px_30px_rgba(20,50,44,0.04)]">
          <CardHeader className="flex-row items-start justify-between gap-4 px-6">
            <div><p className="text-base font-semibold">Outstanding balance</p><p className="mt-1 text-sm text-[#6a7f79]">Illustrative path at {rate.toFixed(2)}%</p></div>
            <div className="rounded-full bg-[#edf6f3] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">{scheduleViewLabel}</div>
          </CardHeader>
          <CardContent className="px-2 pb-1 sm:px-5">
            <ChartContainer config={chartConfig} className="h-[290px] w-full aspect-auto">
              <AreaChart data={balanceData} margin={{ left: 0, right: 16, top: 12, bottom: 0 }}>
                <defs><linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.24} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e8efed" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tickMargin={12} />
                <YAxis axisLine={false} tickLine={false} width={42} tickFormatter={(value) => `₹${value}L`} />
                <ChartTooltip cursor={{ stroke: "#9fb8b2", strokeDasharray: "4 4" }} content={<ChartTooltipContent formatter={(value) => <span className="font-semibold">₹{String(value)} lakh</span>} />} />
                <Area type="monotone" dataKey="balance" stroke="#0f766e" strokeWidth={3} fill="url(#balanceFill)" />
                <ReferenceDot x={String(chartStartYear)} y={balanceData[0]?.balance ?? 0} r={5} fill="#d9f99d" stroke="#0d2824" strokeWidth={3} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-[#dce5e2] bg-[#102f2a] text-white shadow-[0_10px_30px_rgba(20,50,44,0.08)]">
          <CardHeader className="px-6"><div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-white/10"><CalendarDays className="size-5 text-[#d9f99d]" /></div><span className="rounded-full bg-[#d9f99d] px-2.5 py-1 text-xs font-semibold text-[#173d35]">{upcomingInstallment ? (daysUntilDue === 0 ? "Due today" : `In ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`) : "No upcoming"}</span></div></CardHeader>
          <CardContent className="px-6">
            <p className="text-sm text-[#9ec0b8]">Next installment</p><p className="mt-1 text-4xl font-semibold tracking-[-0.04em]">{money(Number(upcomingInstallment?.scheduled_amount ?? loan.regular_emi_amount))}</p><p className="mt-2 text-sm text-[#c6d9d4]">{upcomingInstallment ? displayDate(upcomingInstallment.due_date) : "No scheduled installment"}</p>
            <div className="my-6 h-px bg-white/10" />
            <div className="space-y-3 text-sm">
              <InstallmentDetail label="Installment type" value={upcomingInstallment?.installment_type === "first_installment" ? "First installment" : "Regular EMI"} />
              <InstallmentDetail label={regularInstallment ? `Regular EMI from ${shortDate(regularInstallment.due_date)}` : "Regular EMI"} value={money(Number(loan.regular_emi_amount))} />
            </div>
            <Button className="mt-6 w-full bg-[#d9f99d] text-[#173d35] hover:bg-[#c9ee88]">Record payment<ChevronRight className="size-4" /></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="border-[#cfe4dc] bg-[#f3faf7] shadow-none lg:col-span-2">
          <CardContent className="flex flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#dcefe8] text-[#0f766e]"><CheckCircle2 className="size-5" /></div><div><p className="font-semibold text-[#173d35]">Repayment schedule loaded</p><p className="mt-1 text-sm leading-6 text-[#587069]">{firstInstallment ? `${money(Number(firstInstallment.scheduled_amount))} is due on ${shortDate(firstInstallment.due_date)}.` : "First installment is not available."} {regularInstallment ? `Your regular ${money(Number(regularInstallment.scheduled_amount))} monthly EMI begins on ${shortDate(regularInstallment.due_date)}.` : ""}</p></div></div>
            <Button variant="outline" className="shrink-0 border-[#bfd8cf] bg-white text-[#173d35]">View schedule</Button>
          </CardContent>
        </Card>
        <Card className="border-[#dce5e2] bg-white shadow-none"><CardContent className="px-5"><div className="flex items-center justify-between"><div><p className="text-sm text-[#6a7f79]">Principal repaid</p><p className="mt-1 text-2xl font-semibold">{repaidPercent.toFixed(1)}%</p></div><div className="grid size-10 place-items-center rounded-xl bg-[#edf6f3] text-[#0f766e]"><TrendingDown className="size-5" /></div></div><Progress value={repaidPercent} className="mt-5 h-2 bg-[#e4ecea] [&_[data-slot=progress-indicator]]:bg-[#0f766e]" /><p className="mt-3 text-xs text-[#6a7f79]">Calculated only from recorded principal components.</p></CardContent></Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RateCard data={latestRate} loan={loan} />
        <ActionCard icon={Sparkles} title="Test a prepayment" copy="See how an extra payment changes your tenure and total interest." action="Open simulator" />
        <ActionCard icon={FileText} title="Keep documents together" copy="Store statements, certificates and payment receipts privately." action="View documents" />
      </div>
    </>
  );
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof IndianRupee }) {
  return <Card className="gap-4 border-[#dce5e2] bg-white py-5 shadow-none"><CardContent className="px-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[#6a7f79]">{label}</p><Icon className="size-4 text-[#789089]" /></div><p className="mt-4 text-[1.65rem] font-semibold tracking-[-0.04em]">{value}</p><p className="mt-1 text-xs text-[#789089]">{note}</p></CardContent></Card>;
}

function InstallmentDetail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl bg-white/6 px-3 py-2.5"><span className="text-[#9ec0b8]">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function RateCard({ data, loan }: { data: DashboardData["latestRate"]; loan: DashboardData["loan"] }) {
  const applied = Number(data?.actual_applied_rate ?? loan.current_interest_rate);
  const expected = data?.expected_loan_rate === null || data?.expected_loan_rate === undefined ? null : Number(data.expected_loan_rate);
  const matches = expected !== null && Math.abs(expected - applied) < 0.001;
  const formatRate = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;

  return <Card className="border-[#dce5e2] bg-white shadow-none"><CardContent className="px-5"><div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-[#edf6f3] text-[#0f766e]"><Percent className="size-5" /></div><span className={`flex items-center gap-1 text-xs font-semibold ${data?.verified_at ? "text-[#0f766e]" : "text-amber-700"}`}><CheckCircle2 className="size-3.5" /> {data?.verified_at ? (matches ? "Formula matches" : "Review difference") : "Needs source verification"}</span></div><p className="mt-5 font-semibold">Interest rate watch</p><div className="mt-4 grid grid-cols-3 gap-2"><RateValue label="RBI repo" value={formatRate(data?.rbi_repo_rate)} icon={ArrowDownRight} /><RateValue label={loan.benchmark_name ?? "Benchmark"} value={formatRate(data?.lender_benchmark_rate)} icon={ArrowUpRight} /><RateValue label="Your rate" value={formatRate(applied)} /></div><button type="button" className="mt-5 flex cursor-pointer items-center gap-1 text-sm font-semibold text-[#0f766e]">Open rate watch <ChevronRight className="size-4" /></button></CardContent></Card>;
}

function RateValue({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof ArrowDownRight }) {
  return <div className="rounded-xl bg-[#f4f7f6] p-3"><p className="text-[0.7rem] text-[#6a7f79]">{label}</p><div className="mt-1 flex items-center gap-1"><p className="text-sm font-semibold">{value}</p>{Icon ? <Icon className="size-3 text-[#789089]" /> : null}</div></div>;
}

function ActionCard({ icon: Icon, title, copy, action }: { icon: typeof Sparkles; title: string; copy: string; action: string }) {
  return <Card className="border-[#dce5e2] bg-white shadow-none"><CardContent className="px-5"><div className="grid size-10 place-items-center rounded-xl bg-[#edf6f3] text-[#0f766e]"><Icon className="size-5" /></div><p className="mt-5 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-[#6a7f79]">{copy}</p><button type="button" className="mt-5 flex cursor-pointer items-center gap-1 text-sm font-semibold text-[#0f766e]">{action} <ChevronRight className="size-4" /></button></CardContent></Card>;
}
