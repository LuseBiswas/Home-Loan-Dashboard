"use client";

import Link from "next/link";
import { ChevronDown, Landmark, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProfileMenuProps = {
  userEmail: string;
  lenderName: string;
  loanReference: string | null;
  onSignOut: () => void;
};

function initialsFor(email: string) {
  return email.split("@")[0]?.split(/[._-]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
}

export function ProfileMenu({ userEmail, lenderName, loanReference, onSignOut }: ProfileMenuProps) {
  const initials = initialsFor(userEmail);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-1.5 rounded-full py-1 pr-2 pl-1 hover:bg-[#edf6f3] data-[state=open]:bg-[#edf6f3]" aria-label="Open profile menu">
          <span className="grid size-10 place-items-center rounded-full bg-[#d9f99d] text-sm font-bold text-[#173d35]">{initials}</span>
          <ChevronDown className="size-4 text-[#587069] transition-transform duration-200 in-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-72 rounded-2xl border-[#dce5e2] bg-white p-2 text-[#10201d] shadow-[0_24px_60px_rgba(20,50,44,0.14)]">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#d9f99d] text-sm font-bold text-[#173d35]">{initials}</span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6a7f79]">Signed in as</p>
            <p className="truncate text-sm font-semibold" title={userEmail}>{userEmail || "Unknown account"}</p>
          </div>
        </DropdownMenuLabel>

        <div className="mx-1 mt-1 flex items-center gap-3 rounded-xl bg-[#f4f7f6] px-3 py-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf6f3] text-[#0f766e]"><Landmark className="size-4" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#173d35]">{lenderName}</p>
            <p className="truncate text-xs text-[#6a7f79]">Loan {loanReference ?? "reference unavailable"}</p>
          </div>
        </div>

        <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-xs text-[#6a7f79]">
          <ShieldCheck className="size-3.5 text-[#0f766e]" />
          Your records stay private to your account
        </p>

        <DropdownMenuSeparator className="mx-1 my-2 bg-[#e5ece9]" />

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 font-medium text-[#173d35] focus:bg-[#edf6f3] focus:text-[#173d35]">
          <Link href="/profile"><UserRound className="text-[#0f766e]" />Profile &amp; settings</Link>
        </DropdownMenuItem>

        <DropdownMenuItem variant="destructive" onSelect={onSignOut} className="cursor-pointer rounded-xl px-3 py-2.5 font-medium">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
