"use client";

import { FormEvent, useState } from "react";
import { Landmark, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";

export function AuthScreen() {
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
        <CardHeader className="justify-items-center text-center">
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
        </CardContent>
      </Card>
    </main>
  );
}
