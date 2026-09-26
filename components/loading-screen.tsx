import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingScreenProps = {
  label?: string;
  className?: string;
};

export function LoadingScreen({
  label = "Loading…",
  className,
}: LoadingScreenProps) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "grid min-h-screen place-items-center bg-[#f4f7f6] text-[#173d35]",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm font-medium">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </main>
  );
}
