"use client";

import { FormEvent, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { KeyRound, LoaderCircle, LogOut, MailCheck, MailWarning, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase/client";
import { dateTime, errorMessage, Field, FormStatus, SectionHeading, shortDate, StatusMessage } from "./profile-ui";

export function AccountCard({ user }: { user: User }) {
  const verified = Boolean(user.email_confirmed_at);

  return (
    <Card className="border-[#dce5e2] bg-white shadow-none">
      <CardContent className="px-5 md:px-6">
        <SectionHeading icon={ShieldCheck} title="Account" description="Your sign-in details for this workspace." />
        <dl className="mt-5 space-y-3 text-sm">
          <InfoRow label="Email" value={<span className="truncate" title={user.email}>{user.email ?? "—"}</span>} />
          <InfoRow
            label="Email status"
            value={verified
              ? <span className="inline-flex items-center gap-1 font-semibold text-[#0f766e]"><MailCheck className="size-3.5" />Verified</span>
              : <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><MailWarning className="size-3.5" />Not verified</span>}
          />
          <InfoRow label="Member since" value={shortDate(user.created_at)} />
          <InfoRow label="Last sign-in" value={user.last_sign_in_at ? dateTime(user.last_sign_in_at) : "—"} />
        </dl>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f4f7f6] px-3 py-2.5">
      <dt className="shrink-0 text-[#6a7f79]">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-[#173d35]">{value}</dd>
    </div>
  );
}

export function SecurityCard({ email }: { email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setStatus({ tone: "error", text: "The new passwords don't match." });
      return;
    }
    if (newPassword === currentPassword) {
      setStatus({ tone: "error", text: "Choose a password different from your current one." });
      return;
    }

    setBusy(true);
    try {
      // Supabase doesn't check the old password on update, so confirm it first.
      const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (check.error) throw new Error("Your current password is incorrect.");

      const update = await supabase.auth.updateUser({ password: newPassword });
      if (update.error) throw update.error;

      formRef.current?.reset();
      setStatus({ tone: "success", text: "Password updated." });
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Could not update your password.") });
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    setSignOutError(null);
    const result = await supabase.auth.signOut({ scope: "global" });
    if (result.error) setSignOutError(result.error.message);
  }

  return (
    <Card className="border-[#dce5e2] bg-white shadow-none">
      <CardContent className="px-5 md:px-6">
        <SectionHeading icon={KeyRound} title="Security" description="Keep your financial records protected." />

        <form ref={formRef} onSubmit={changePassword} className="mt-5 space-y-4">
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
          <Field label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
          <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          <StatusMessage status={status} />
          <Button disabled={busy} className="w-full bg-[#173d35] text-white hover:bg-[#0d2824]">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Update password
          </Button>
        </form>

        <div className="mt-6 border-t border-[#e5ece9] pt-5">
          <p className="text-sm font-semibold">Sign out everywhere</p>
          <p className="mt-1 text-sm leading-6 text-[#6a7f79]">Ends every session, including other browsers and devices. Useful if you signed in on a shared computer.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-3 w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"><LogOut className="size-4" />Sign out of all devices</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
                <AlertDialogDescription>You&apos;ll be signed out here too and will need your password to sign back in.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={signOutEverywhere}>Sign out everywhere</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {signOutError ? <p className="mt-2 text-xs font-medium text-red-700">{signOutError}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
