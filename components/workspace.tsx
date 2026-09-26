"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { LoanSetup } from "@/components/loan-setup";
import { StatusScreen } from "@/components/status-screen";
import { loadPrimaryLoan, LoanRow } from "@/lib/loan-service";
import { supabase } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/use-supabase-session";

type WorkspaceValue = {
  session: Session;
  loan: LoanRow;
  refreshLoan: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <Workspace>.");
  return value;
}

// Owns sign-in, the loan and the app shell for every workspace route, so navigating
// between pages only swaps the content area instead of reloading the whole screen.
export function Workspace({ children }: { children: React.ReactNode }) {
  const [loan, setLoan] = useState<LoanRow | null>(null);
  const [loanLoaded, setLoanLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const clearLoan = useCallback(() => {
    setLoan(null);
    setLoanLoaded(false);
  }, []);
  const { session, ready } = useSupabaseSession(clearLoan);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let active = true;
    loadPrimaryLoan(userId)
      .then((nextLoan) => {
        if (!active) return;
        setLoadError(null);
        setLoan(nextLoan);
        setLoanLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load loan data.");
        setLoanLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [userId, refreshIndex]);

  const refreshLoan = useCallback(() => setRefreshIndex((value) => value + 1), []);
  const signOut = useCallback(() => {
    void supabase.auth.signOut();
  }, []);

  // The loader stays up until its count reaches 100%, so start-up ends on a full fill rather
  // than vanishing mid-count; it shows again after signing in while the loan loads.
  const booting = !ready || (Boolean(session) && !loanLoaded);
  const [loaderVisible, setLoaderVisible] = useState(true);
  if (booting && !loaderVisible) setLoaderVisible(true);
  const hideLoader = useCallback(() => setLoaderVisible(false), []);

  if (loaderVisible) {
    return (
      <LoadingScreen
        label={ready && session ? "Preparing your loan dashboard…" : "Opening your workspace…"}
        detail={ready && session ? "Fetching your balance, EMI schedule and rate checks." : "Checking your secure sign-in."}
        done={!booting}
        onFinished={hideLoader}
      />
    );
  }

  if (!session) return <AuthScreen />;

  if (loadError) {
    return <StatusScreen title="We couldn't load your loan details." detail={loadError} actionLabel="Sign out" onAction={signOut} />;
  }

  if (!loan) return <LoanSetup userId={session.user.id} onCreated={refreshLoan} onSignOut={signOut} />;

  return (
    <WorkspaceContext.Provider value={{ session, loan, refreshLoan }}>
      <AppShell lenderName={loan.lender_name} loanReference={loan.loan_reference_masked} userEmail={session.user.email ?? ""} onSignOut={signOut}>
        {children}
      </AppShell>
    </WorkspaceContext.Provider>
  );
}
