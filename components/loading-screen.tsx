import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingProps = {
  label?: string;
  detail?: string;
  className?: string;
};

function LoadingMark({ size }: { size: "lg" | "sm" }) {
  const large = size === "lg";
  return (
    <div className={cn("relative grid place-items-center", large ? "size-20" : "size-14")} aria-hidden="true">
      <span className={cn("absolute inset-0 border-2 border-[#dce5e2]", large ? "rounded-[1.75rem]" : "rounded-[1.35rem]")} />
      <span className={cn("absolute inset-0 animate-spin border-2 border-transparent border-t-[#0f766e] [animation-duration:1.1s] motion-reduce:animate-none", large ? "rounded-[1.75rem]" : "rounded-[1.35rem]")} />
      <div className={cn("grid place-items-center bg-[#d9f99d] text-[#173d35]", large ? "size-14 rounded-2xl shadow-[0_12px_30px_rgba(20,50,44,0.12)]" : "size-10 rounded-xl")}>
        <Landmark className={large ? "size-6" : "size-5"} strokeWidth={2.3} />
      </div>
    </div>
  );
}

function LoadingBar() {
  return (
    <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-[#e4ecea]" aria-hidden="true">
      <div className="h-full w-1/3 rounded-full bg-[#0f766e] animate-[loading-bar_1.4s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
    </div>
  );
}

export function LoadingScreen({
  label = "Loading…",
  detail,
  className,
}: LoadingProps) {
  return (
    <main
      aria-busy="true"
      className={cn(
        "grid min-h-screen place-items-center bg-[#f4f7f6] px-5 py-10 text-[#10201d]",
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <LoadingMark size="lg" />

        <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#6a7f79]">
          Home Loan Compass
        </p>
        <p role="status" aria-live="polite" className="mt-2 text-lg font-semibold tracking-tight text-[#173d35]">
          {label}
        </p>
        {detail ? (
          <p className="mt-1.5 text-sm leading-6 text-[#6a7f79]">{detail}</p>
        ) : null}

        <LoadingBar />
      </div>
    </main>
  );
}

// Loader for the content area inside the app shell, so the sidebar and top bar stay in place.
export function ContentLoading({
  label = "Loading…",
  detail,
  className,
}: LoadingProps) {
  return (
    <div aria-busy="true" className={cn("grid min-h-[calc(100dvh-76px-4rem)] place-items-center", className)}>
      <div className="flex max-w-sm flex-col items-center text-center">
        <LoadingMark size="sm" />
        <p role="status" aria-live="polite" className="mt-5 font-semibold tracking-tight text-[#173d35]">{label}</p>
        {detail ? <p className="mt-1 text-sm leading-6 text-[#6a7f79]">{detail}</p> : null}
        <LoadingBar />
      </div>
    </div>
  );
}
