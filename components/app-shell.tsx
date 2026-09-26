"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, CalendarDays, FileText, Gauge, Landmark, LayoutDashboard, Menu, Sparkles, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/profile-menu";
import { exitDemo } from "@/lib/demo";

const navItems: { label: string; icon: typeof LayoutDashboard; href?: string }[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Schedule", icon: CalendarDays, href: "/schedule" },
  { label: "Simulator", icon: Gauge, href: "/simulator" },
  // Rate watch is hidden for now; re-add `Percent` to the lucide import to bring it back.
  // { label: "Rate watch", icon: Percent },
  { label: "Documents", icon: FileText, href: "/documents" },
  { label: "Profile", icon: UserRound, href: "/profile" },
];

type AppShellProps = {
  lenderName: string;
  loanReference: string | null;
  userEmail: string;
  onSignOut: () => void;
  demo?: boolean;
  children: React.ReactNode;
};

export function AppShell({ lenderName, loanReference, userEmail, onSignOut, demo = false, children }: AppShellProps) {
  const pathname = usePathname();
  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#10201d]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 self-start overflow-y-auto border-r border-[#dce5e2] bg-[#0d2824] px-5 py-7 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-10 place-items-center rounded-xl bg-[#d9f99d] text-[#173d35]">
              <Landmark className="size-5" strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#9ec0b8]">Home loan</p>
              <p className="text-lg font-semibold tracking-tight">Compass</p>
            </div>
          </div>
          <nav className="mt-10 space-y-1" aria-label="Primary navigation">
            {navItems.map(({ label, icon: Icon, href }) => {
              const isActive = href === "/" ? pathname === "/" : Boolean(href && pathname.startsWith(href));
              const className = `flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${isActive ? "bg-white/12 text-white" : "text-[#9ec0b8] hover:bg-white/7 hover:text-white"}`;
              return href ? (
                <Link key={label} href={href} className={className} aria-current={isActive ? "page" : undefined}>
                  <Icon className="size-[18px]" />{label}
                </Link>
              ) : (
                <button key={label} type="button" className={className}>
                  <Icon className="size-[18px]" />{label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#dce5e2] bg-white/85 px-5 backdrop-blur md:px-8 xl:px-10">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.13em] text-[#6a7f79]">Loan {loanReference ?? "reference unavailable"}</p>
                <p className="mt-1 text-sm font-semibold text-[#243b36]">{lenderName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" aria-label="Notifications" className="rounded-full"><Bell className="size-4" /></Button>
              <ProfileMenu userEmail={userEmail} lenderName={lenderName} loanReference={loanReference} onSignOut={onSignOut} />
            </div>
          </header>

          <div className="px-5 py-7 md:px-8 xl:px-10 xl:py-9">
            {demo ? <DemoBanner /> : null}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function DemoBanner() {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-[#102f2a] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between md:px-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d9f99d] text-[#173d35]"><Sparkles className="size-4" /></span>
        <div>
          <p className="text-sm font-semibold">You&apos;re exploring a sample loan</p>
          <p className="text-xs leading-5 text-[#c6d9d4]">Try anything: edit forms, run the simulator, open the schedule. Saving is turned off in the demo.</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" className="bg-[#d9f99d] text-[#173d35] hover:bg-[#c9ee88]" onClick={() => exitDemo({ signup: true })}>Create your account</Button>
        <Button type="button" size="sm" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => exitDemo()}>Exit demo</Button>
      </div>
    </div>
  );
}
