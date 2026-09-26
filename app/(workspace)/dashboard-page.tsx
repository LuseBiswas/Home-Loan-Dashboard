"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoanDashboard } from "./loan-dashboard";
import { ContentLoading } from "@/components/loading-screen";
import { useWorkspace } from "@/components/workspace";
import { DashboardData, loadDashboardDetails } from "@/lib/loan-service";
import { isRateCheckDue, markRateChecked, refreshOfficialRates } from "@/lib/rate-monitor";

type DashboardDetails = Omit<DashboardData, "loan">;

// Keeps the last loaded overview so returning to this tab renders instantly while it refreshes.
const detailsCache = new Map<string, DashboardDetails>();

export function DashboardPage() {
  const { session, loan, demo } = useWorkspace();
  const [details, setDetails] = useState<{ loanId: string; value: DashboardDetails } | null>(() => {
    const cached = detailsCache.get(loan.id);
    return cached ? { loanId: loan.id, value: cached } : null;
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rateRefreshing, setRateRefreshing] = useState(false);
  const [rateRefreshError, setRateRefreshError] = useState<string | null>(null);
  const rateRefreshInFlight = useRef(false);
  const loanId = loan.id;
  const accessToken = session.access_token;

  useEffect(() => {
    let active = true;
    loadDashboardDetails(loanId)
      .then((value) => {
        if (!active) return;
        detailsCache.set(loanId, value);
        setLoadError(null);
        setDetails({ loanId, value });
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load your dashboard.");
      });

    return () => {
      active = false;
    };
  }, [loanId]);

  const checkOfficialRates = useCallback(async () => {
    if (rateRefreshInFlight.current) return;

    rateRefreshInFlight.current = true;
    setRateRefreshing(true);
    setRateRefreshError(null);

    try {
      const result = await refreshOfficialRates(loanId, accessToken);
      const cached = detailsCache.get(loanId);
      if (cached) detailsCache.set(loanId, { ...cached, latestRate: result.current, previousRate: result.previous });
      setDetails((current) => current && current.loanId === loanId
        ? { loanId, value: { ...current.value, latestRate: result.current, previousRate: result.previous } }
        : current);
      markRateChecked(loanId);
    } catch (error) {
      setRateRefreshError(error instanceof Error ? error.message : "Could not check official rates.");
    } finally {
      rateRefreshInFlight.current = false;
      setRateRefreshing(false);
    }
  }, [loanId, accessToken]);

  const detailsReady = details?.loanId === loanId;

  useEffect(() => {
    if (demo || !detailsReady || !isRateCheckDue(loanId)) return;

    const refreshTimer = window.setTimeout(() => {
      void checkOfficialRates();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [checkOfficialRates, demo, detailsReady, loanId]);

  if (loadError) {
    return <p className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">We couldn&apos;t load your dashboard. {loadError}</p>;
  }

  if (!detailsReady) {
    return <ContentLoading label="Loading your overview…" detail="Fetching your balance, EMI schedule and rate checks." />;
  }

  return (
    <LoanDashboard
      data={{ loan, ...details.value }}
      rateRefreshing={rateRefreshing}
      rateRefreshError={rateRefreshError}
      onRefreshRates={checkOfficialRates}
    />
  );
}
