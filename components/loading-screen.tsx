"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const DESTINATIONS: [prefix: string, name: string][] = [
  ["/schedule", "Schedule"],
  ["/simulator", "Simulator"],
  ["/documents", "Documents"],
  ["/profile", "Profile"],
];

// The tab the visitor is heading to, named from the URL.
function destinationFor(pathname: string | null) {
  return DESTINATIONS.find(([prefix]) => pathname?.startsWith(prefix))?.[1] ?? "Dashboard";
}

const ESTIMATE_CAP = 94;
const ESTIMATE_PACE_MS = 900;
const FINISH_MS = 380;
const HOLD_AT_FULL_MS = 180;

// Real loading has no measurable progress, so the count is an estimate: it climbs quickly,
// slows down and never passes ESTIMATE_CAP until `done`, then runs to 100 and reports back.
function useLoadingProgress(done: boolean, onFinished?: () => void) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let frame = 0;
    let holdTimer = 0;
    const startedAt = performance.now();
    const from = progressRef.current;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      let next: number;
      if (done) {
        const t = Math.min(1, elapsed / FINISH_MS);
        next = from + (100 - from) * (1 - (1 - t) ** 3);
      } else {
        next = Math.max(from, ESTIMATE_CAP * (1 - Math.exp(-(elapsed + 1) / ESTIMATE_PACE_MS)));
      }

      progressRef.current = next;
      setProgress(next);

      if (done && next >= 100) {
        holdTimer = window.setTimeout(() => onFinishedRef.current?.(), HOLD_AT_FULL_MS);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
    };
  }, [done]);

  return Math.min(100, Math.floor(progress));
}

type Tone = "dark" | "light";

const tones: Record<Tone, { outline: string; fill: string; row: string; detail: string }> = {
  dark: { outline: "rgba(217, 249, 157, 0.85)", fill: "#d9f99d", row: "text-[#9ec0b8]", detail: "text-[#9ec0b8]" },
  light: { outline: "#173d35", fill: "#0f766e", row: "text-[#789089]", detail: "text-[#6a7f79]" },
};

function PercentFill({ value, tone, className }: { value: number; tone: Tone; className: string }) {
  const colors = tones[tone];
  const text = `${value}%`;
  return (
    <div className={cn("relative font-extrabold leading-none tracking-[-0.06em] tabular-nums select-none", className)} aria-hidden="true">
      <span style={{ color: "transparent", WebkitTextStroke: `1.5px ${colors.outline}` }}>{text}</span>
      <span className="absolute inset-0" style={{ color: colors.fill, clipPath: `inset(${100 - value}% 0 0 0)` }}>{text}</span>
    </div>
  );
}

function MarqueeRow({ word, tone, reverse = false }: { word: string; tone: Tone; reverse?: boolean }) {
  const items = Array.from({ length: 12 }, (_, index) => index);
  return (
    <div className="overflow-hidden" aria-hidden="true">
      <div className={cn("flex w-max motion-safe:animate-[loader-marquee_28s_linear_infinite]", reverse && "[animation-direction:reverse]")}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0">
            {items.map((index) => (
              <span key={index} className={cn("px-10 text-sm font-medium tracking-[0.35em] uppercase", tones[tone].row)}>{word}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const grain = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

type LoadingProps = {
  label?: string;
  detail?: string;
  className?: string;
};

// Full-screen loader for app start-up and sign-in. Pass `done` once loading has finished: it
// runs the count to 100% and calls `onFinished`, so the app can appear after the fill completes.
export function LoadingScreen({ label = "Loading…", detail, className, done = false, onFinished }: LoadingProps & { done?: boolean; onFinished?: () => void }) {
  const destination = destinationFor(usePathname());
  const value = useLoadingProgress(done, onFinished);

  return (
    <main aria-busy={!done} className={cn("relative flex min-h-dvh flex-col justify-between overflow-hidden bg-[#0d2824] py-5 text-white", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: grain }} aria-hidden="true" />
      <MarqueeRow word={destination} tone="dark" />

      <div className="relative flex flex-col items-center px-4 text-center">
        <PercentFill value={value} tone="dark" className="text-[clamp(6rem,22vw,17rem)]" />
        <p role="status" aria-live="polite" className="mt-6 text-sm font-medium tracking-wide text-[#d9f99d]">{label}</p>
        {detail ? <p className={cn("mt-1 text-sm", tones.dark.detail)}>{detail}</p> : null}
      </div>

      <MarqueeRow word={destination} tone="dark" reverse />
    </main>
  );
}

// Loader for the content area inside the app shell, so the sidebar and top bar stay in place.
// `compact` drops the moving rows for small spaces such as a single card.
export function ContentLoading({ label = "Loading…", detail, className, compact = false }: LoadingProps & { compact?: boolean }) {
  const destination = destinationFor(usePathname());
  const value = useLoadingProgress(false);

  return (
    <div aria-busy="true" className={cn("flex min-h-[calc(100dvh-76px-4rem)] flex-col justify-between overflow-hidden py-4", compact && "min-h-0 justify-center py-8", className)}>
      {compact ? null : <MarqueeRow word={destination} tone="light" />}
      <div className="flex flex-col items-center px-4 text-center">
        <PercentFill value={value} tone="light" className={compact ? "text-6xl" : "text-[clamp(4.5rem,12vw,10rem)]"} />
        <p role="status" aria-live="polite" className="mt-4 text-sm font-medium text-[#173d35]">{label}</p>
        {detail ? <p className={cn("mt-1 text-sm", tones.light.detail)}>{detail}</p> : null}
      </div>
      {compact ? null : <MarqueeRow word={destination} tone="light" reverse />}
    </div>
  );
}
