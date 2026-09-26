"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Eye, EyeOff, FileCheck2, Landmark, LoaderCircle, PiggyBank, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSignupRequest, enterDemo, signupRequestedFromDemo } from "@/lib/demo";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">(() => (signupRequestedFromDemo() ? "signup" : "signin"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const signingIn = mode === "signin";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const result = signingIn
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (result.error) {
      setMessage({ tone: "error", text: result.error.message });
      return;
    }
    clearSignupRequest();

    if (!signingIn && !result.data.session) {
      setMessage({ tone: "info", text: "Account created. Check your email to confirm it, then log in." });
      setMode("signin");
    }
  }

  function switchMode() {
    setMode(signingIn ? "signup" : "signin");
    setMessage(null);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#eef3f1] px-4 py-8 text-[#10201d] sm:px-6 md:py-6">
      <div className="grid w-full max-w-[80rem] gap-4 rounded-[2.5rem] bg-white p-4 shadow-[0_30px_90px_rgba(20,50,44,0.12)] md:grid-cols-[1.05fr_1fr]">
        <Showcase />

        <section className="flex flex-col px-6 py-10 sm:px-14 md:py-12">
          <div className="flex items-center justify-center gap-2">
            <span className="grid size-11 place-items-center rounded-xl bg-[#d9f99d] text-[#173d35]"><Landmark className="size-6" strokeWidth={2.3} /></span>
            <span className="text-xl font-semibold tracking-tight">Home Loan Compass</span>
          </div>

          <div className="mt-12 text-center md:mt-14">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-[3.4rem]">{signingIn ? "Welcome back!" : "Create your account"}</h1>
            <p className="mt-4 text-lg text-[#6a7f79]">{signingIn ? "Log in to see where your home loan stands." : "Track your EMIs, rates and prepayments in one place."}</p>
          </div>

          <form className="mx-auto mt-12 w-full max-w-lg space-y-8" onSubmit={submit}>
            <UnderlineField label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent py-2 text-lg outline-none placeholder:text-[#a9b8b3]"
              />
            </UnderlineField>

            <UnderlineField label="Password" htmlFor="password" hint={signingIn ? undefined : "At least 8 characters."}>
              <div className="flex items-center gap-2">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  autoComplete={signingIn ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent py-2 text-lg outline-none placeholder:text-[#a9b8b3]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#587069] transition hover:bg-[#edf6f3] hover:text-[#173d35]"
                >
                  {showPassword ? <EyeOff className="size-6" /> : <Eye className="size-6" />}
                </button>
              </div>
            </UnderlineField>

            {message ? (
              <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-2xl p-4 text-base leading-7", message.tone === "error" ? "bg-red-50 text-red-700" : "bg-[#edf6f3] text-[#0f766e]")}>
                {message.text}
              </p>
            ) : null}

            <Button disabled={busy} className="h-[3.75rem] w-full rounded-full bg-[#10201d] text-lg font-semibold text-white hover:bg-[#173d35]">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {signingIn ? "Log in" : "Create account"}
            </Button>

            <div className="flex items-center gap-3 text-xs text-[#9aaba6]" aria-hidden="true"><span className="h-px flex-1 bg-[#e5ece9]" />or<span className="h-px flex-1 bg-[#e5ece9]" /></div>

            <Button type="button" variant="outline" onClick={enterDemo} className="h-[3.75rem] w-full rounded-full border-[#dce5e2] bg-[#f4f7f6] text-lg font-semibold text-[#173d35] hover:bg-[#edf6f3] hover:text-[#173d35]">
              <Sparkles className="size-5 text-[#0f766e]" />Explore a demo loan
            </Button>
            <p className="-mt-5 text-center text-sm text-[#6a7f79]">See everything the app does with sample data. No account needed.</p>
          </form>

          <p className="mt-auto pt-10 text-center text-base text-[#6a7f79]">
            {signingIn ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={switchMode} className="cursor-pointer font-semibold text-[#10201d] underline-offset-4 hover:underline">
              {signingIn ? "Sign up" : "Log in"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}

function UnderlineField({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#cfdad6] transition-colors focus-within:border-[#10201d]">
      <label htmlFor={htmlFor} className="block text-[0.95rem] font-medium text-[#6a7f79]">{label}</label>
      {children}
      {hint ? <p className="pb-2 text-sm text-[#789089]">{hint}</p> : null}
    </div>
  );
}

// Illustrative preview of what the app does; the figures are examples, not the visitor's data.
function Showcase() {
  const bars = [
    { principal: 8, interest: 92 },
    { principal: 11, interest: 89 },
    { principal: 15, interest: 85 },
    { principal: 21, interest: 79 },
    { principal: 29, interest: 71 },
    { principal: 40, interest: 60 },
    { principal: 55, interest: 45 },
    { principal: 76, interest: 24 },
  ];

  return (
    <aside aria-hidden="true" className="relative hidden min-h-[min(800px,calc(100dvh-4rem))] overflow-hidden rounded-[2rem] bg-[#102f2a] md:block">
      <div className="absolute -top-24 -left-28 size-[26rem] rounded-full bg-[#d9f99d] opacity-90" />
      <div className="absolute top-60 -right-36 size-[30rem] rounded-full bg-[#0d9488] opacity-70" />
      <div className="absolute -bottom-36 left-16 size-96 rounded-full border-[40px] border-[#d9f99d]/25" />
      <div className="absolute right-20 bottom-52 size-20 rounded-full bg-white/15 backdrop-blur-sm" />
      <div className="absolute top-28 left-1/2 size-14 rounded-full bg-white/20 backdrop-blur-sm" />

      <div className="relative flex h-full flex-col p-10">
        <div className="ml-auto w-[23rem] rounded-3xl bg-white/90 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur motion-safe:animate-[auth-float_7s_ease-in-out_infinite]">
          <div className="flex items-center gap-2.5 text-base font-semibold text-[#0f766e]"><CheckCircle2 className="size-6" />Rate matches your contract</div>
          <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
            <Chip label="Benchmark" value="13.15%" />
            <Chip label="Spread" value="−4.65%" />
            <Chip label="Applied" value="8.50%" strong />
          </div>
        </div>

        <div className="mt-8 w-[26rem] rounded-3xl bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.2)] [animation-delay:-2s] motion-safe:animate-[auth-float_8s_ease-in-out_infinite]">
          <p className="text-base font-semibold text-[#173d35]">Where your EMI goes</p>
          <div className="mt-5 flex h-36 items-end gap-2.5">
            {bars.map((bar, index) => (
              <div key={index} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                <span className="rounded-t-[3px] bg-[#eb6834]" style={{ height: `${bar.interest * 0.9}%` }} />
                <span className="bg-[#0d9488]" style={{ height: `${bar.principal * 0.9}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-5 text-sm text-[#587069]">
            <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#0d9488]" />Principal</span>
            <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#eb6834]" />Interest</span>
          </div>
        </div>

        <div className="mt-8 ml-auto flex w-[20rem] items-center gap-4 rounded-3xl bg-[#d9f99d] p-5 [@media(max-height:800px)]:hidden text-[#173d35] shadow-[0_18px_40px_rgba(0,0,0,0.2)] [animation-delay:-4s] motion-safe:animate-[auth-float_6s_ease-in-out_infinite]">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#173d35] text-[#d9f99d]"><PiggyBank className="size-7" /></span>
          <div>
            <p className="text-sm font-medium">Prepay ₹1 lakh, save</p>
            <p className="text-2xl font-semibold tracking-tight">₹9.4 lakh interest</p>
          </div>
        </div>

        <div className="mt-auto pt-10 text-white">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-[#d9f99d]"><FileCheck2 className="size-5" />Schedule · Simulator · Documents</p>
          <p className="mt-4 max-w-md text-[2rem] leading-tight font-semibold tracking-[-0.02em]">Know exactly where your home loan stands.</p>
          <p className="mt-3 max-w-md text-base leading-7 text-[#c6d9d4]">Check your rate against your contract, see every EMI, and plan prepayments with confidence.</p>
        </div>
      </div>
    </aside>
  );
}

function Chip({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl px-2.5 py-2.5", strong ? "bg-[#102f2a] text-white" : "bg-[#f4f7f6] text-[#173d35]")}>
      <p className={cn("text-xs", strong ? "text-[#9ec0b8]" : "text-[#6a7f79]")}>{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
