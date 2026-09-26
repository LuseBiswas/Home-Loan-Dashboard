"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportLoanData } from "@/lib/loan-service";
import { downloadFile, toCsv } from "@/lib/download";
import { errorMessage, FormStatus, SectionHeading, StatusMessage } from "./profile-ui";
import { useDemoMode } from "@/lib/demo";
import { DemoNote } from "@/components/demo-note";

type ExportKind = "json" | "rates" | "schedule" | "payments";

const exports: { kind: ExportKind; label: string; detail: string; icon: typeof FileJson }[] = [
  { kind: "json", label: "Full backup", detail: "Everything, as JSON", icon: FileJson },
  { kind: "rates", label: "Rate history", detail: "CSV", icon: FileSpreadsheet },
  { kind: "schedule", label: "Repayment schedule", detail: "CSV", icon: FileSpreadsheet },
  { kind: "payments", label: "Payments", detail: "CSV", icon: FileSpreadsheet },
];

export function ExportCard({ loanId }: { loanId: string }) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [status, setStatus] = useState<FormStatus>(null);
  const demo = useDemoMode();

  async function download(kind: ExportKind) {
    setBusy(kind);
    setStatus(null);

    try {
      const data = await exportLoanData(loanId);
      const stamp = data.exportedAt.slice(0, 10);

      if (kind === "json") {
        downloadFile(`home-loan-backup-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
      } else if (kind === "rates") {
        downloadFile(`rate-history-${stamp}.csv`, toCsv(data.rateEvents, [
          "effective_date", "actual_applied_rate", "expected_loan_rate", "lender_benchmark_rate",
          "benchmark_spread_percent", "rbi_repo_rate", "verified_at", "source_url", "notes",
        ]), "text/csv");
      } else if (kind === "schedule") {
        downloadFile(`repayment-schedule-${stamp}.csv`, toCsv(data.installments, [
          "schedule_version_number", "installment_number", "installment_type", "due_date",
          "scheduled_amount", "principal_amount", "interest_amount", "opening_balance", "closing_balance",
        ]), "text/csv");
      } else {
        if (data.payments.length === 0) {
          setStatus({ tone: "error", text: "No payments recorded yet, so there's nothing to export." });
          return;
        }
        downloadFile(`payments-${stamp}.csv`, toCsv(data.payments, [
          "payment_date", "amount", "payment_type", "principal_component", "interest_component", "transaction_reference", "notes",
        ]), "text/csv");
      }
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Could not prepare the export.") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-[#dce5e2] bg-white shadow-none">
      <CardContent className="px-5 md:px-6">
        <SectionHeading icon={Download} title="Export your data" description="Keep a backup, or share records with your CA or lender." />
        <div className="mt-5 grid gap-2">
          {exports.map(({ kind, label, detail, icon: Icon }) => (
            <Button
              key={kind}
              type="button"
              variant="outline"
              disabled={busy !== null || demo}
              onClick={() => download(kind)}
              className="h-auto justify-between border-[#dce5e2] px-3 py-2.5 hover:bg-[#f3faf7] hover:text-[#10201d]"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-[#edf6f3] text-[#0f766e]"><Icon className="size-4" /></span>
                <span className="text-left"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs font-normal text-[#6a7f79]">{detail}</span></span>
              </span>
              {busy === kind ? <LoaderCircle className="size-4 animate-spin text-[#587069]" /> : <Download className="size-4 text-[#587069]" />}
            </Button>
          ))}
        </div>
        <div className="mt-3 space-y-2"><StatusMessage status={status} /><DemoNote /></div>
        <p className="mt-3 text-xs leading-5 text-[#6a7f79]">The backup lists your documents but doesn&apos;t include the files themselves.</p>
      </CardContent>
    </Card>
  );
}
