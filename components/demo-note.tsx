"use client";

import { Lock } from "lucide-react";
import { useDemoMode } from "@/lib/demo";
import { cn } from "@/lib/utils";

// Shown next to save buttons, which are disabled in demo mode.
export function DemoNote({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  if (!useDemoMode()) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs", tone === "dark" ? "text-[#c6d9d4]" : "text-[#6a7f79]", className)}>
      <Lock className="size-3.5 shrink-0" aria-hidden="true" />Saving is off in the demo.
    </p>
  );
}
