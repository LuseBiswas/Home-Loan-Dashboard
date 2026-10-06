"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import {
  CalendarDays, FileText, Gauge, Landmark, LayoutDashboard, Menu, Sparkles, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/profile-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { exitDemo } from "@/lib/demo";
import { loadRateHistory } from "@/lib/loan-service";

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
  loanId: string;
  currentRate: number;
  lenderName: string;
  loanReference: string | null;
  userEmail: string;
  onSignOut: () => void;
  demo?: boolean;
  children: React.ReactNode;
};

export function AppShell({ loanId, currentRate, lenderName, loanReference, userEmail, onSignOut, demo = false, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  return (
    // reducedMotion="user" keeps movement off for people who turned it off in their system settings.
    <MotionConfig reducedMotion="user">
    <main className="min-h-screen bg-[#f4f7f6] text-[#10201d]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 self-start overflow-y-auto border-r border-[#dce5e2] bg-[#0d2824] px-5 py-7 text-white lg:flex lg:flex-col">
          <Brand />
          <NavLinks />
        </aside>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent
            side="left"
            overlayClassName="bg-[#0d2824]/35 backdrop-blur-sm"
            className="w-[280px] gap-0 border-r-0 bg-[#0d2824] px-5 py-7 text-white sm:max-w-[280px] [&>button:last-child]:top-7 [&>button:last-child]:right-5 [&>button:last-child]:grid [&>button:last-child]:size-10 [&>button:last-child]:place-items-center [&>button:last-child]:rounded-xl [&>button:last-child]:text-[#9ec0b8] [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/10 [&>button:last-child]:hover:text-white"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Move between sections of Home Loan Compass.</SheetDescription>
            <Brand />
            <NavLinks onNavigate={() => setMenuOpen(false)} animated />
            <div className="mt-auto space-y-2">
              {menuOpen ? <DrawerRates loanId={loanId} fallbackRate={currentRate} /> : null}
              <div className="rounded-xl bg-white/7 px-3 py-3">
                <p className="truncate text-sm font-semibold">{lenderName}</p>
                <p className="truncate text-xs text-[#9ec0b8]">Loan {loanReference ?? "reference unavailable"}</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#dce5e2] bg-white/85 px-4 backdrop-blur md:px-8 lg:h-[76px] xl:px-10">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu /></Button>
              <div className="flex items-center gap-2 lg:hidden">
                <span className="grid size-8 place-items-center rounded-lg bg-[#d9f99d] text-[#173d35]"><Landmark className="size-4" strokeWidth={2.3} /></span>
                <span className="text-base font-semibold tracking-tight">Compass</span>
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-medium uppercase tracking-[0.13em] text-[#6a7f79]">Loan {loanReference ?? "reference unavailable"}</p>
                <p className="mt-1 text-sm font-semibold text-[#243b36]">{lenderName}</p>
              </div>
            </div>
            <ProfileMenu userEmail={userEmail} lenderName={lenderName} loanReference={loanReference} onSignOut={onSignOut} />
          </header>

          <div className="px-4 py-6 md:px-8 md:py-7 xl:px-10 xl:py-9">
            {demo ? <DemoBanner /> : null}
            {/* Each tab's content rises in when you switch; the sidebar and header stay put. */}
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </section>
      </div>
    </main>
    </MotionConfig>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-10 place-items-center rounded-xl bg-[#d9f99d] text-[#173d35]">
        <Landmark className="size-5" strokeWidth={2.3} />
      </div>
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#9ec0b8]">Home loan</p>
        <p className="text-lg font-semibold tracking-tight">Compass</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate, animated = false }: { onNavigate?: () => void; animated?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="mt-10 space-y-1" aria-label="Primary navigation">
      {navItems.map(({ label, icon: Icon, href }, index) => {
        const isActive = href === "/" ? pathname === "/" : Boolean(href && pathname.startsWith(href));
        const className = `flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${isActive ? "bg-white/12 text-white" : "text-[#9ec0b8] hover:bg-white/7 hover:text-white"}`;
        const item = href ? (
          <Link href={href} className={className} aria-current={isActive ? "page" : undefined} onClick={onNavigate}>
            <Icon className="size-[18px]" />{label}
          </Link>
        ) : (
          <button type="button" className={className}>
            <Icon className="size-[18px]" />{label}
          </button>
        );
        // In the mobile drawer the links slide in one after another as it opens.
        return animated ? (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.12 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            {item}
          </motion.div>
        ) : <div key={label}>{item}</div>;
      })}
    </nav>
  );
}

type DrawerRateValues = { repo: number | null; applied: number | null };

// Mounted only while the drawer is open, so every open shows the latest stored rate check.
function DrawerRates({ loanId, fallbackRate }: { loanId: string; fallbackRate: number }) {
  const [rates, setRates] = useState<DrawerRateValues | null>(null);

  useEffect(() => {
    let active = true;
    loadRateHistory(loanId)
      .then(([latest]) => {
        if (!active) return;
        setRates({
          repo: latest?.rbi_repo_rate == null ? null : Number(latest.rbi_repo_rate),
          applied: latest?.actual_applied_rate == null ? null : Number(latest.actual_applied_rate),
        });
      })
      .catch(() => {
        if (active) setRates({ repo: null, applied: null });
      });
    return () => {
      active = false;
    };
  }, [loanId]);

  const format = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(2)}%`);
  return (
    <div className="grid grid-cols-2 gap-2" aria-busy={rates === null}>
      <div className="rounded-xl bg-white/7 px-3 py-2.5">
        <p className="text-[0.68rem] text-[#9ec0b8]">RBI repo</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">{rates ? format(rates.repo) : "…"}</p>
      </div>
      <div className="rounded-xl bg-[#d9f99d] px-3 py-2.5 text-[#173d35]">
        <p className="text-[0.68rem] text-[#3d5c55]">Applied rate</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">{rates ? format(rates.applied ?? fallbackRate) : "…"}</p>
      </div>
    </div>
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
