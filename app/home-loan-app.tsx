"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoanDashboard } from "./loan-dashboard";
import { LoanSetup } from "./loan-setup";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { StatusScreen } from "@/components/status-screen";
import { DashboardData, loadDashboardData } from "@/lib/loan-service";
import { isRateCheckDue, markRateChecked, refreshOfficialRates } from "@/lib/rate-monitor";
import { supabase } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/use-supabase-session";

export function HomeLoanApp() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [rateRefreshing, setRateRefreshing] = useState(false);
  const [rateRefreshError, setRateRefreshError] = useState<string | null>(null);
  const rateRefreshInFlight = useRef(false);

  const clearData = useCallback(() => {
    setData(null);
    setDataLoading(false);
  }, []);
  const { session, ready: authReady } = useSupabaseSession(clearData);

  const checkOfficialRates = useCallback(async () => {
    const loanId = data?.loan.id;
    const accessToken = session?.access_token;
    if (!loanId || !accessToken || rateRefreshInFlight.current) return;

    rateRefreshInFlight.current = true;
    setRateRefreshing(true);
    setRateRefreshError(null);

    try {
      const result = await refreshOfficialRates(loanId, accessToken);
      setData((current) => current && current.loan.id === loanId
        ? {
            ...current,
            latestRate: result.current,
            previousRate: result.previous,
          }
        : current);
      markRateChecked(loanId);
    } catch (error) {
      setRateRefreshError(error instanceof Error ? error.message : "Could not check official rates.");
    } finally {
      rateRefreshInFlight.current = false;
      setRateRefreshing(false);
    }
  }, [data?.loan.id, session?.access_token]);

  useEffect(() => {
    if (!session?.user.id) return;

    let active = true;
    loadDashboardData(session.user.id)
      .then((nextData) => {
        if (active) {
          setLoadError(null);
          setData(nextData);
          setDataLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Could not load loan data.");
          setDataLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user.id, refreshIndex]);

  useEffect(() => {
    const loanId = data?.loan.id;
    if (!loanId || !session?.access_token) return;
    if (!isRateCheckDue(loanId)) return;

    const refreshTimer = window.setTimeout(() => {
      void checkOfficialRates();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [checkOfficialRates, data?.loan.id, session?.access_token]);

  if (!authReady) return <LoadingScreen label="Opening your workspace…" detail="Checking your secure sign-in." />;
  if (!session) return <AuthScreen />;

  if (loadError) {
    return (
      <StatusScreen
        title="We couldn't load your loan details."
        detail={loadError}
        actionLabel="Sign out"
        onAction={() => supabase.auth.signOut()}
      />
    );
  }

  if (dataLoading) return <LoadingScreen label="Preparing your loan dashboard…" detail="Fetching your balance, EMI schedule and rate checks." />;

  if (!data) {
    return (
      <LoanSetup
        userId={session.user.id}
        onCreated={() => setRefreshIndex((value) => value + 1)}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <LoanDashboard
      data={data}
      userEmail={session.user.email ?? ""}
      onSignOut={() => supabase.auth.signOut()}
      rateRefreshing={rateRefreshing}
      rateRefreshError={rateRefreshError}
      onRefreshRates={checkOfficialRates}
    />
  );
}
