import type { AmortizationRow, ReduceOption } from "@/lib/amortization";
import { addMonthsIso, exactEmi, isEmi } from "@/lib/amortization";

export type LumpSum = { amount: number; date: string };
export type RecurringExtra = { amount: number; frequency: "monthly" | "yearly"; startDate: string; endDate?: string };
export type EmiStepUp = { percent: number; startDate: string };
export type RateChange = { rate: number; fromDate: string };

export type Scenario = {
  reduce: ReduceOption;
  lumpSums: LumpSum[];
  recurring: RecurringExtra | null;
  stepUp: EmiStepUp | null;
  rateChange: RateChange | null;
};

export type ScenarioSide = {
  interest: number;
  paid: number;
  emisLeft: number;
  lastDate: string | null;
  firstEmi: number | null;
  lastEmi: number | null;
};

export type SimulationResult = {
  rows: AmortizationRow[];
  current: ScenarioSide;
  scenario: ScenarioSide;
  interestSaved: number;
  emisSaved: number;
  extraPaid: number;
  // Largest EMI the scenario asks for, e.g. after step-ups or a forced rise on a rate hike.
  peakEmi: number | null;
};

// Longest schedule a scenario may run to, so a steep rate rise can't loop forever.
const MAX_MONTHS = 600;

function extrasBetween(scenario: Scenario, fromInclusive: string, toExclusive: string | null, emiStartDate: string) {
  let total = 0;
  for (const lump of scenario.lumpSums) {
    if (lump.amount > 0 && lump.date >= fromInclusive && (toExclusive === null || lump.date < toExclusive)) total += lump.amount;
  }

  const recurring = scenario.recurring;
  if (recurring && recurring.amount > 0) {
    const step = recurring.frequency === "monthly" ? 1 : 12;
    // Recurring payments fall on the same day as the start date, month after month.
    for (let index = 0; index < MAX_MONTHS; index += step) {
      const date = addMonthsIso(recurring.startDate, index);
      if (toExclusive !== null && date >= toExclusive) break;
      if (recurring.endDate && date > recurring.endDate) break;
      if (date >= fromInclusive && date >= emiStartDate) total += recurring.amount;
    }
  }

  return total;
}

function side(rows: AmortizationRow[]): ScenarioSide {
  const emis = rows.filter(isEmi);
  return {
    interest: rows.reduce((sum, row) => sum + row.exactInterest, 0),
    paid: rows.reduce((sum, row) => sum + row.exactInterest + row.exactPrincipal + row.prepayment, 0),
    emisLeft: emis.length,
    lastDate: emis.at(-1)?.dueDate ?? null,
    firstEmi: emis[0]?.emi ?? null,
    lastEmi: emis.length > 1 ? emis.at(-2)!.emi : emis[0]?.emi ?? null,
  };
}

// Runs a what-if on top of the loan's real schedule. EMIs before `fromDate` are history and stay
// as they are; from the next EMI onwards each month charges interest, takes the EMI, then applies
// any extra payment made on or after that EMI and before the next one — the same rule recorded
// prepayments follow. Nothing here is saved.
export function simulate({ baseline, annualRate, emiStartDate, fromDate, scenario }: {
  baseline: AmortizationRow[];
  annualRate: number;
  emiStartDate: string;
  fromDate: string;
  scenario: Scenario;
}): SimulationResult | null {
  const startIndex = baseline.findIndex((row) => isEmi(row) && row.dueDate >= fromDate);
  if (startIndex < 0) return null;

  const history = baseline.slice(0, startIndex);
  const future = baseline.slice(startIndex);
  const futureEmis = future.filter(isEmi);
  const firstFuture = futureEmis[0];
  const remainingAtStart = futureEmis.length;

  let balance = firstFuture.opening;
  let rate = annualRate;
  let emi = exactEmi(balance, rate, remainingAtStart);
  let extraPaid = 0;
  let peakEmi = 0;
  const rows: AmortizationRow[] = [];

  // Extras made between the last paid EMI and the first simulated one reduce the opening balance.
  const lastPaid = [...history].reverse().find(isEmi);
  const earlyExtras = lastPaid ? Math.min(balance, extrasBetween(scenario, fromDate, firstFuture.dueDate, emiStartDate)) : 0;
  if (earlyExtras > 0 && lastPaid) {
    const index = history.lastIndexOf(lastPaid);
    history[index] = { ...lastPaid, prepayment: lastPaid.prepayment + earlyExtras, closing: lastPaid.closing - earlyExtras };
    balance -= earlyExtras;
    extraPaid += earlyExtras;
    if (scenario.reduce === "emi") emi = exactEmi(balance, rate, remainingAtStart);
  }

  // EMI rises by the step-up percentage on the start date and every 12 months after it.
  let nextStepUp = scenario.stepUp && scenario.stepUp.percent > 0 ? scenario.stepUp.startDate : null;

  for (let index = 0; index < MAX_MONTHS && balance > 0.005; index += 1) {
    const number = firstFuture.number + index;
    const dueDate = addMonthsIso(emiStartDate, number - 1);
    const nextDueDate = addMonthsIso(emiStartDate, number);
    const monthsLeft = Math.max(1, remainingAtStart - index);

    if (scenario.rateChange && dueDate >= scenario.rateChange.fromDate && rate !== scenario.rateChange.rate) {
      rate = scenario.rateChange.rate;
      // Lenders keep the EMI and move the tenure on a rate change; only recalculate the EMI if it
      // would no longer cover the interest, or when the user chose to keep the tenure.
      if (scenario.reduce === "emi" || emi <= balance * (rate / 1200)) emi = exactEmi(balance, rate, monthsLeft);
    }

    while (nextStepUp && scenario.stepUp && dueDate >= nextStepUp) {
      emi *= 1 + scenario.stepUp.percent / 100;
      nextStepUp = addMonthsIso(nextStepUp, 12);
    }

    const interest = balance * (rate / 1200);
    const principal = Math.min(balance, Math.max(0, emi - interest));
    balance = Math.max(0, balance - principal);

    const extra = balance > 0 ? Math.min(balance, extrasBetween(scenario, dueDate, nextDueDate, emiStartDate)) : 0;
    balance -= extra;
    extraPaid += extra;
    peakEmi = Math.max(peakEmi, principal + interest);

    // Printed like lender schedules: EMI rounded up to the rupee, interest rounded, principal the rest.
    const shownInterest = Math.round(interest);
    const shownEmi = balance + extra <= 0.005 ? Math.round(principal + interest) : Math.ceil(emi - 1e-6);
    rows.push({
      number,
      dueDate,
      opening: balance + principal + extra,
      principal: shownEmi - shownInterest,
      interest: shownInterest,
      emi: shownEmi,
      closing: balance,
      exactPrincipal: principal,
      exactInterest: interest,
      prepayment: extra,
      kind: "emi",
    });

    if (extra > 0 && scenario.reduce === "emi" && balance > 0.005) emi = exactEmi(balance, rate, Math.max(1, monthsLeft - 1));
  }

  const current = side(future);
  const simulated = side(rows);
  return {
    rows: [...history, ...rows],
    current,
    scenario: simulated,
    interestSaved: current.interest - simulated.interest,
    emisSaved: current.emisLeft - simulated.emisLeft,
    extraPaid,
    peakEmi: rows.length > 0 ? peakEmi : null,
  };
}
