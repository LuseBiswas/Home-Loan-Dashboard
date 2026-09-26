import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AmortizationRow, totalsOf } from "@/lib/amortization";

// Same hues as the repayment chart, stepped for the dark card (validated on #102f2a).
const PRINCIPAL = "#0d9488";
const INTEREST = "#d95926";

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

const longDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
}).format(new Date(`${date}T00:00:00`));

const shortDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(`${date}T00:00:00`));

function localIso(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

type NextInstallmentCardProps = {
  rows: AmortizationRow[];
  upcoming: { due_date: string; scheduled_amount: number; installment_type: string } | undefined;
};

export function NextInstallmentCard({ rows, upcoming }: NextInstallmentCardProps) {
  const today = localIso(new Date());
  const nextRow = rows.find((row) => row.dueDate >= today);
  const isFirstInstallment = upcoming?.installment_type === "first_installment";
  const dueDate = upcoming?.due_date ?? nextRow?.dueDate;
  const amount = upcoming ? Number(upcoming.scheduled_amount) : nextRow?.emi;
  const daysUntilDue = dueDate
    ? Math.max(0, Math.round((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000))
    : null;
  const split = !isFirstInstallment && nextRow && nextRow.dueDate === dueDate ? nextRow : null;
  const principalShare = split ? (split.principal / split.emi) * 100 : 0;

  const paidRows = rows.filter((row) => row.dueDate < today);
  const paid = totalsOf(paidRows);
  const paidPercent = rows.length > 0 ? (paidRows.length / rows.length) * 100 : 0;

  return (
    <Card className="h-full border-[#dce5e2] bg-[#102f2a] text-white shadow-[0_10px_30px_rgba(20,50,44,0.08)]">
      <CardHeader className="px-6">
        <div className="flex items-center justify-between">
          <div className="grid size-10 place-items-center rounded-xl bg-white/10"><CalendarDays className="size-5 text-[#d9f99d]" /></div>
          <span className="rounded-full bg-[#d9f99d] px-2.5 py-1 text-xs font-semibold text-[#173d35]">
            {daysUntilDue === null ? "No upcoming" : daysUntilDue === 0 ? "Due today" : `In ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-6">
        <p className="text-sm text-[#9ec0b8]">Next installment</p>
        <p className="mt-1 text-4xl font-semibold tracking-[-0.04em]">{amount !== undefined ? money(amount) : "—"}</p>
        <p className="mt-2 text-sm text-[#c6d9d4]">{dueDate ? longDate(dueDate) : "No scheduled installment"}</p>
        {split ? <p className="mt-1 text-xs text-[#9ec0b8]">EMI {split.number} of {rows.length}</p> : isFirstInstallment ? <p className="mt-1 text-xs text-[#9ec0b8]">First installment</p> : null}

        {split ? (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9ec0b8]">Where this EMI goes</p>
            <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Principal ${principalShare.toFixed(0)}%, interest ${(100 - principalShare).toFixed(0)}%`}>
              <span className="rounded-l-full" style={{ width: `${principalShare}%`, backgroundColor: PRINCIPAL }} />
              <span className="flex-1 rounded-r-full" style={{ backgroundColor: INTEREST }} />
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <SplitRow color={PRINCIPAL} label="Principal" value={money(split.principal)} share={principalShare} />
              <SplitRow color={INTEREST} label="Interest" value={money(split.interest)} share={100 - principalShare} />
              <Detail label="Balance after this EMI" value={money(split.closing)} />
            </div>
          </div>
        ) : null}

        <div className="my-6 h-px bg-white/10" />

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9ec0b8]">Repaid so far</p>
            <p className="text-xs text-[#c6d9d4]">{paidRows.length} of {rows.length} EMIs</p>
          </div>
          <Progress value={paidPercent} className="mt-3 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#d9f99d]" />
          <div className="mt-4 space-y-2 text-sm">
            <Detail label="Principal repaid" value={money(paid.principal)} swatch={PRINCIPAL} />
            {paid.prepaid > 0 ? <Detail label="Incl. prepayments" value={money(paid.prepaid)} /> : null}
            <Detail label="Interest paid" value={money(paid.interest)} swatch={INTEREST} />
            <Detail label="Total paid" value={money(paid.total)} strong />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#9ec0b8]">
            {paidRows.length === 0 && rows[0]
              ? `Your first EMI is on ${shortDate(rows[0].dueDate)}.`
              : "Based on your schedule, assuming every EMI was paid on time."}
          </p>
        </div>

        <div className="mt-auto pt-6">
          <Button asChild className="w-full bg-[#d9f99d] text-[#173d35] hover:bg-[#c9ee88]">
            <Link href="/schedule#next">View EMI schedule<ChevronRight className="size-4" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SplitRow({ color, label, value, share }: { color: string; label: string; value: string; share: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/6 px-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-[#c6d9d4]"><span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />{label}</span>
      <span className="text-right font-medium">{value}<span className="ml-1.5 text-xs font-normal text-[#9ec0b8]">{share.toFixed(0)}%</span></span>
    </div>
  );
}

function Detail({ label, value, swatch, strong = false }: { label: string; value: string; swatch?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/6 px-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-[#9ec0b8]">
        {swatch ? <span className="size-2 rounded-full" style={{ backgroundColor: swatch }} aria-hidden="true" /> : null}{label}
      </span>
      <span className={strong ? "text-right font-semibold" : "text-right font-medium"}>{value}</span>
    </div>
  );
}
