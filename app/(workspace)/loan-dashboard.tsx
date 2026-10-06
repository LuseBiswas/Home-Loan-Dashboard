"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight,
  FileText, IndianRupee, Percent, Sparkles, WalletCards,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RateWatchStrip } from "@/components/rate-watch-strip";
import { NextInstallmentCard } from "@/components/next-installment-card";
import { RepaymentBreakdown } from "@/components/repayment-breakdown";
import { loanSchedule } from "@/lib/amortization";
import type { DashboardData } from "@/lib/loan-service";

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

function localIso(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

const shortDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(`${date}T00:00:00`));

export function LoanDashboard({ data, rateRefreshing, rateRefreshError, onRefreshRates }: { data: DashboardData; rateRefreshing: boolean; rateRefreshError: string | null; onRefreshRates: () => void }) {
  const { loan, installments, latestRate, previousRate, revisions } = data;
  const now = new Date();
  const upcomingInstallment = installments.find((item) => new Date(`${item.due_date}T23:59:59`) >= now);
  const rate = Number(latestRate?.actual_applied_rate ?? loan.current_interest_rate);
  const schedule = useMemo(() => loanSchedule(loan, rate, revisions), [loan, rate, revisions]);
  // Balances follow the schedule (every EMI on its due date) plus recorded prepayments.
  const todayIso = localIso(now);
  const financed = Number(loan.total_financed_amount);
  const lastPaidRow = [...schedule].reverse().find((row) => row.dueDate < todayIso);
  const outstandingPrincipal = lastPaidRow ? lastPaidRow.closing : financed;
  const principalPaid = Math.max(0, financed - outstandingPrincipal);
  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(now);

  return (
    <>
      {/* On smaller screens the repo and applied rates sit in the navigation drawer instead. */}
      <div className="hidden lg:block">
      <RateWatchStrip
        benchmarkName={loan.benchmark_name}
        spread={loan.benchmark_spread_percent === null ? null : Number(loan.benchmark_spread_percent)}
        latest={latestRate}
        previous={previousRate}
        refreshing={rateRefreshing}
        refreshError={rateRefreshError}
        onRefresh={onRefreshRates}
      />
      </div>

      <div className="flex lg:mt-7 flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#587069]">{todayLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Your loan, clearly mapped.</h1>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-7 sm:gap-4 xl:grid-cols-4">
        {/* The four summary cards arrive one after another. */}
        <RiseIn order={0}><MetricCard label="Outstanding principal" value={money(outstandingPrincipal)} note={principalPaid > 0 ? `${money(principalPaid)} repaid, as per schedule` : "Before first scheduled EMI"} icon={IndianRupee} /></RiseIn>
        <RiseIn order={1}><MetricCard label="Regular EMI" value={money(Number(loan.regular_emi_amount))} note={loan.regular_emi_start_date ? `Starts ${shortDate(loan.regular_emi_start_date)}` : "Start date unavailable"} icon={WalletCards} /></RiseIn>
        <RiseIn order={2}><MetricCard label="Current interest rate" value={`${rate.toFixed(2)}%`} note={`${loan.interest_type === "floating" ? "Floating" : loan.interest_type} · ${loan.benchmark_name ?? "Benchmark unavailable"}${loan.benchmark_spread_percent !== null ? ` ${Number(loan.benchmark_spread_percent) >= 0 ? "+" : "−"} ${Math.abs(Number(loan.benchmark_spread_percent)).toFixed(2)}%` : ""}`} icon={Percent} /></RiseIn>
        <RiseIn order={3}><MetricCard label="Original tenure" value={`${loan.original_tenure_months} months`} note="Schedule revisions are versioned" icon={CalendarDays} /></RiseIn>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        {/* Next installment comes first when the cards stack; side by side it stays on the right. */}
        <div className="min-w-0 xl:order-2"><NextInstallmentCard rows={schedule} upcoming={upcomingInstallment} /></div>
        <div className="min-w-0 xl:order-1 [&>*]:h-full"><RepaymentBreakdown rows={schedule} /></div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Rate watch is hidden for now. */}
        {/* <RateCard data={latestRate} loan={loan} /> */}
        <ActionCard icon={Sparkles} title="Test a prepayment" copy="See how an extra payment changes your tenure and total interest." action="Open simulator" href="/simulator" />
        <ActionCard icon={FileText} title="Keep documents together" copy="Store statements, certificates and payment receipts privately." action="View documents" href="/documents" />
      </div>
    </>
  );
}

// Fades a card up into place; `order` staggers neighbouring cards.
function RiseIn({ order, children }: { order: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 + order * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="[&>*]:h-full"
    >
      {children}
    </motion.div>
  );
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof IndianRupee }) {
  return <Card className="gap-4 border-[#dce5e2] bg-white py-3.5 shadow-none sm:py-5"><CardContent className="px-3.5 sm:px-5"><div className="flex items-start justify-between gap-2"><p className="text-xs leading-4 font-medium text-[#6a7f79] sm:text-sm sm:leading-5">{label}</p><Icon className="size-3.5 shrink-0 text-[#789089] sm:size-4" /></div><p className="mt-2.5 text-lg font-semibold tracking-[-0.03em] sm:mt-4 sm:text-[1.65rem] sm:tracking-[-0.04em]">{value}</p><p className="mt-1 line-clamp-2 text-[0.68rem] leading-4 text-[#789089] sm:text-xs">{note}</p></CardContent></Card>;
}

// Kept for the Rate watch feature, which is hidden for now.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function ActionCard({ icon: Icon, title, copy, action, href }: { icon: typeof Sparkles; title: string; copy: string; action: string; href?: string }) {
  const actionClass = "mt-5 flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-[#0f766e]";
  return <Card className="border-[#dce5e2] bg-white shadow-none"><CardContent className="px-5"><div className="grid size-10 place-items-center rounded-xl bg-[#edf6f3] text-[#0f766e]"><Icon className="size-5" /></div><p className="mt-5 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-[#6a7f79]">{copy}</p>{href ? <Link href={href} className={actionClass}>{action} <ChevronRight className="size-4" /></Link> : <button type="button" className={actionClass}>{action} <ChevronRight className="size-4" /></button>}</CardContent></Card>;
}
