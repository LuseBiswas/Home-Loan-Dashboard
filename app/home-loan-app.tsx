"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Landmark, LoaderCircle, ShieldCheck } from "lucide-react";
import { LoanDashboard } from "./loan-dashboard";
import { LoanSetup } from "./loan-setup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/loading-screen";
import { DashboardData, loadDashboardData } from "@/lib/loan-service";
import { refreshOfficialRates } from "@/lib/rate-monitor";
import { supabase } from "@/lib/supabase/client";

export function HomeLoanApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [rateRefreshing, setRateRefreshing] = useState(false);
  const [rateRefreshError, setRateRefreshError] = useState<string | null>(null);
  const rateRefreshInFlight = useRef(false);

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
      window.localStorage.setItem(`official-rate-check:${loanId}`, String(Date.now()));
    } catch (error) {
      setRateRefreshError(error instanceof Error ? error.message : "Could not check official rates.");
    } finally {
      rateRefreshInFlight.current = false;
      setRateRefreshing(false);
    }
  }, [data?.loan.id, session?.access_token]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: current }) => {
      setSession(current.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setData(null);
        setDataLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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

    const lastChecked = Number(window.localStorage.getItem(`official-rate-check:${loanId}`) ?? 0);
    const sixHours = 6 * 60 * 60 * 1_000;
    if (Date.now() - lastChecked < sixHours) return;

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
        title="Supabase is connected, but the loan data could not load."
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

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Account created. Check your email to confirm it, then sign in.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f6] px-5 py-10 text-[#10201d]">
      <Card className="w-full max-w-md border-[#dce5e2] bg-white shadow-[0_24px_80px_rgba(20,50,44,0.10)]">
        <CardHeader className="items-center text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#d9f99d] text-[#173d35]">
            <Landmark className="size-6" />
          </div>
          <div className="mt-3">
            <h1 className="text-2xl font-semibold tracking-tight">Home Loan Compass</h1>
            <p className="mt-2 text-sm leading-6 text-[#6a7f79]">
              Sign in to access your private loan dashboard.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="email">Email</label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
              <Input id="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {message ? <p className="rounded-xl bg-[#f4f7f6] p-3 text-sm leading-5 text-[#4f6761]">{message}</p> : null}
            <Button disabled={busy} className="w-full bg-[#173d35] text-white hover:bg-[#0d2824]">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button type="button" className="mt-5 w-full cursor-pointer text-sm font-semibold text-[#0f766e]" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>
            {mode === "signin" ? "Create your account" : "Already have an account? Sign in"}
          </button>
          <div className="mt-6 flex items-start gap-2 border-t border-[#e6ecea] pt-5 text-xs leading-5 text-[#6a7f79]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0f766e]" />
            Your records are protected by Supabase authentication and row-level security.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function StatusScreen({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel: string; onAction: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f6] px-5 text-[#10201d]">
      <Card className="max-w-lg border-[#dce5e2] bg-white"><CardContent className="px-6 text-center"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#6a7f79]">{detail}</p><Button className="mt-6" variant="outline" onClick={onAction}>{actionLabel}</Button></CardContent></Card>
    </main>
  );
}
