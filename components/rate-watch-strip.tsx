"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RateEventRow } from "@/lib/loan-service";
import { useDemoMode } from "@/lib/demo";

const RBI_SOURCE = "https://m.rbi.org.in/scripts/faqview.aspx?id=130";
const PNB_SOURCE = "https://www.pnbhousing.com/home-loan/interest-rates";

type RateWatchStripProps = {
  benchmarkName: string | null;
  spread: number | null;
  latest: RateEventRow | null;
  previous: RateEventRow | null;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
};

function rate(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;
}

function changeInBps(current: number | null, previous: number | null | undefined) {
  if (current === null || previous === null || previous === undefined) return null;
  return Math.round((Number(current) - Number(previous)) * 100);
}

export function RateWatchStrip({
  benchmarkName,
  spread,
  latest,
  previous,
  refreshing,
  refreshError,
  onRefresh,
}: RateWatchStripProps) {
  const [copied, setCopied] = useState(false);
  const demo = useDemoMode();
  const expected = latest?.expected_loan_rate === null || latest?.expected_loan_rate === undefined
    ? null
    : Number(latest.expected_loan_rate);
  const applied = latest?.actual_applied_rate === null || latest?.actual_applied_rate === undefined
    ? null
    : Number(latest.actual_applied_rate);
  const differenceBps = expected === null || applied === null
    ? null
    : Math.round((applied - expected) * 100);
  const matched = differenceBps !== null && Math.abs(differenceBps) <= 1;
  const repoChange = latest && previous
    ? changeInBps(Number(latest.rbi_repo_rate), previous.rbi_repo_rate)
    : null;
  const benchmarkChange = latest && previous
    ? changeInBps(Number(latest.lender_benchmark_rate), previous.lender_benchmark_rate)
    : null;

  const status = differenceBps === null
    ? "Contract match cannot be calculated yet"
    : matched
      ? "Your applied rate matches the contract"
      : differenceBps > 0
        ? `Your applied rate is ${differenceBps} bps above the contract formula`
        : `Your applied rate is ${Math.abs(differenceBps)} bps below the contract formula`;

  const changeMessage = repoChange === null && benchmarkChange === null
    ? null
    : `Since the previous snapshot: RBI repo ${formatChange(repoChange)}, ${benchmarkName ?? "benchmark"} ${formatChange(benchmarkChange)}.`;

  const checkedLabel = latest?.verified_at
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(latest.verified_at))
    : "Not checked yet";

  async function copySummary() {
    const lines = [
      "Home loan rate review",
      `RBI policy repo rate: ${rate(latest?.rbi_repo_rate)}`,
      `${benchmarkName ?? "Lender benchmark"}: ${rate(latest?.lender_benchmark_rate)}`,
      `Contractual spread: ${spread === null ? "Unavailable" : `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}%`}`,
      `Expected contractual rate: ${rate(expected)}`,
      `Bank-applied rate: ${rate(applied)}`,
      `Result: ${status}`,
      changeMessage,
      `Official sources last checked: ${checkedLabel}`,
      `RBI source: ${RBI_SOURCE}`,
      `PNB Housing source: ${PNB_SOURCE}`,
    ].filter(Boolean);

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <section className="rounded-2xl border border-[#cfe1dc] bg-white px-4 py-4 shadow-[0_8px_26px_rgba(20,50,44,0.04)] md:px-5" aria-label="Official rate monitor">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${matched ? "bg-[#e2f3ec] text-[#0f766e]" : "bg-amber-50 text-amber-700"}`}>
            {matched ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Official rate monitor</p>
              <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide ${matched ? "bg-[#e2f3ec] text-[#0f766e]" : "bg-amber-50 text-amber-700"}`}>
                {matched ? "Matched" : latest ? "Review" : "Pending"}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#4f6761]">{status}</p>
            {changeMessage ? <p className="mt-1 text-xs text-[#6a7f79]">{changeMessage}</p> : null}
            {refreshError ? <p className="mt-1 text-xs font-medium text-red-700">Automatic check failed: {refreshError}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
          <RateCell label="RBI repo" value={rate(latest?.rbi_repo_rate)} />
          <RateCell label={benchmarkName ?? "Benchmark"} value={rate(latest?.lender_benchmark_rate)} />
          <RateCell label="Expected" value={rate(expected)} />
          <RateCell label="Applied" value={rate(applied)} emphasis />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[#e5ece9] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6a7f79]">
          <span>Last checked: {checkedLabel}</span>
          <a href={RBI_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0f766e]">RBI source<ExternalLink className="size-3" /></a>
          <a href={PNB_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0f766e]">PNB source<ExternalLink className="size-3" /></a>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={refreshing || demo} onClick={onRefresh}>
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking…" : "Check now"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!latest} onClick={copySummary}>
            {copied ? <ClipboardCheck className="size-3.5" /> : <Clipboard className="size-3.5" />}
            {copied ? "Copied" : "Copy review"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function RateCell({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-xl px-3 py-2.5 ${emphasis ? "bg-[#102f2a] text-white" : "bg-[#f4f7f6]"}`}><p className={`text-[0.68rem] ${emphasis ? "text-[#9ec0b8]" : "text-[#6a7f79]"}`}>{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div>;
}

function formatChange(bps: number | null) {
  if (bps === null) return "unavailable";
  if (bps === 0) return "unchanged";
  return `${bps > 0 ? "increased" : "decreased"} ${Math.abs(bps)} bps`;
}
