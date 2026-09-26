import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FormStatus = { tone: "success" | "error"; text: string } | null;

export const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

export const shortDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(date.length === 10 ? `${date}T00:00:00` : date));

export const dateTime = (value: string) => new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

export const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function SectionHeading({ icon: Icon, title, description, action }: { icon: typeof CheckCircle2; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf6f3] text-[#0f766e]"><Icon className="size-5" /></div>
        <div>
          <h2 className="font-semibold text-[#10201d]">{title}</h2>
          <p className="mt-0.5 text-sm leading-6 text-[#6a7f79]">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function Field({ label, name, hint, className, ...props }: { label: string; name: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className={cn("space-y-1.5 text-sm font-medium", className)}>
      <span>{label}</span>
      <Input name={name} {...props} />
      {hint ? <span className="block text-xs font-normal text-[#6a7f79]">{hint}</span> : null}
    </label>
  );
}

export function StatusMessage({ status }: { status: FormStatus }) {
  if (!status) return null;
  const success = status.tone === "success";
  const Icon = success ? CheckCircle2 : TriangleAlert;
  return (
    <p role={success ? "status" : "alert"} className={cn("flex items-start gap-2 rounded-xl p-3 text-sm leading-5", success ? "bg-[#edf6f3] text-[#0f766e]" : "bg-red-50 text-red-700")}>
      <Icon className="mt-0.5 size-4 shrink-0" />{status.text}
    </p>
  );
}

export function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f4f7f6] px-3 py-2.5">
      <p className="text-[0.7rem] text-[#6a7f79]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#173d35]">{value}</p>
    </div>
  );
}

export const selectClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
