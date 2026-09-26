import { Landmark, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingScreenProps = {
  label?: string;
  detail?: string;
  className?: string;
};

export function LoadingScreen({
  label = "Loading…",
  detail,
  className,
}: LoadingScreenProps) {
  return (
    <main
      aria-busy="true"
      className={cn(
        "grid min-h-screen place-items-center bg-[#f4f7f6] px-5 py-10 text-[#10201d]",
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative grid size-20 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-[1.75rem] border-2 border-[#dce5e2]" />
          <span className="absolute inset-0 animate-spin rounded-[1.75rem] border-2 border-transparent border-t-[#0f766e] [animation-duration:1.1s] motion-reduce:animate-none" />
          <div className="grid size-14 place-items-center rounded-2xl bg-[#d9f99d] text-[#173d35] shadow-[0_12px_30px_rgba(20,50,44,0.12)]">
            <Landmark className="size-6" strokeWidth={2.3} />
          </div>
        </div>

        <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#6a7f79]">
          Home Loan Compass
        </p>
        <p role="status" aria-live="polite" className="mt-2 text-lg font-semibold tracking-tight text-[#173d35]">
          {label}
        </p>
        {detail ? (
          <p className="mt-1.5 text-sm leading-6 text-[#6a7f79]">{detail}</p>
        ) : null}

        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-[#e4ecea]" aria-hidden="true">
          <div className="h-full w-1/3 rounded-full bg-[#0f766e] animate-[loading-bar_1.4s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
        </div>

        <p className="mt-10 flex items-center gap-1.5 text-xs text-[#6a7f79]">
          <ShieldCheck className="size-3.5 text-[#0f766e]" aria-hidden="true" />
          Your records stay private to your account
        </p>
      </div>
    </main>
  );
}
