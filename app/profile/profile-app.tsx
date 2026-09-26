"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { StatusScreen } from "@/components/status-screen";
import { loadProfileData, ProfileData } from "@/lib/loan-service";
import { supabase } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/use-supabase-session";
import { AccountCard, SecurityCard } from "./account-card";
import { ExportCard } from "./export-card";
import { LoanDetailsCard } from "./loan-details-card";
import { RateRevisionCard } from "./rate-revision-card";

export function ProfileApp() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const clearData = useCallback(() => {
    setData(null);
    setLoading(false);
  }, []);
  const { session, ready } = useSupabaseSession(clearData);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let active = true;
    loadProfileData(userId)
      .then((nextData) => {
        if (!active) return;
        setLoadError(null);
        setData(nextData);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load your profile.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, refreshIndex]);

  const reload = useCallback(() => setRefreshIndex((value) => value + 1), []);
  const signOut = () => supabase.auth.signOut();

  if (!ready) return <LoadingScreen label="Opening your workspace…" detail="Checking your secure sign-in." />;
  if (!session) return <AuthScreen />;

  if (loadError) {
    return <StatusScreen title="We couldn't load your profile." detail={loadError} actionLabel="Back to dashboard" onAction={() => router.push("/")} />;
  }

  if (loading) return <LoadingScreen label="Opening your profile…" detail="Fetching your account and loan settings." />;

  if (!data) {
    return <StatusScreen title="Set up your loan first" detail="Your profile shows your loan details once you've created a loan profile." actionLabel="Create loan profile" onAction={() => router.push("/")} />;
  }

  const userEmail = session.user.email ?? "";

  return (
    <AppShell active="profile" lenderName={data.loan.lender_name} loanReference={data.loan.loan_reference_masked} userEmail={userEmail} onSignOut={signOut}>
      <div>
        <p className="text-sm font-medium text-[#587069]">Profile &amp; settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Your account and loan.</h1>
      </div>

      <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="min-w-0 space-y-4">
          <LoanDetailsCard loan={data.loan} onSaved={reload} />
          <RateRevisionCard loan={data.loan} history={data.rateHistory} onSaved={reload} />
        </div>
        <div className="min-w-0 space-y-4">
          <AccountCard user={session.user} />
          <SecurityCard email={userEmail} />
          <ExportCard loanId={data.loan.id} />
        </div>
      </div>
    </AppShell>
  );
}
