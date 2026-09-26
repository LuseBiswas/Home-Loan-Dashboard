"use client";

import { useCallback, useEffect, useState } from "react";
import { ContentLoading } from "@/components/loading-screen";
import { useWorkspace } from "@/components/workspace";
import { loadRateHistory, RateHistoryRow } from "@/lib/loan-service";
import { AccountCard, SecurityCard } from "./account-card";
import { ExportCard } from "./export-card";
import { LoanDetailsCard } from "./loan-details-card";
import { RateRevisionCard } from "./rate-revision-card";

// Keeps the last loaded history so returning to this tab renders instantly while it refreshes.
const historyCache = new Map<string, RateHistoryRow[]>();

export function ProfileApp() {
  const { session, loan, refreshLoan } = useWorkspace();
  const loanId = loan.id;
  const [history, setHistory] = useState<{ loanId: string; rows: RateHistoryRow[] } | null>(() => {
    const cached = historyCache.get(loan.id);
    return cached ? { loanId: loan.id, rows: cached } : null;
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    loadRateHistory(loanId)
      .then((rows) => {
        if (!active) return;
        historyCache.set(loanId, rows);
        setLoadError(null);
        setHistory({ loanId, rows });
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load your profile.");
      });

    return () => {
      active = false;
    };
  }, [loanId, refreshIndex]);

  const reload = useCallback(() => {
    refreshLoan();
    setRefreshIndex((value) => value + 1);
  }, [refreshLoan]);

  const userEmail = session.user.email ?? "";

  return (
    <>
      <div>
        <p className="text-sm font-medium text-[#587069]">Profile &amp; settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Your account and loan.</h1>
      </div>

      <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="min-w-0 space-y-4">
          <LoanDetailsCard loan={loan} onSaved={reload} />
          {loadError ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">We couldn&apos;t load your rate history. {loadError}</p>
          ) : history?.loanId === loanId ? (
            <RateRevisionCard loan={loan} history={history.rows} onSaved={reload} />
          ) : (
            <ContentLoading compact label="Loading rate history…" className="rounded-xl border border-[#dce5e2] bg-white" />
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <AccountCard user={session.user} />
          <SecurityCard email={userEmail} />
          <ExportCard loanId={loanId} />
        </div>
      </div>
    </>
  );
}
