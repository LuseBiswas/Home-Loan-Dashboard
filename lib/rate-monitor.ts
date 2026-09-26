import type { RateEventRow } from "@/lib/loan-service";

export type OfficialRateRefresh = {
  current: RateEventRow;
  previous: RateEventRow | null;
  changed: boolean;
  sources: {
    rbi: string;
    benchmark: string;
  };
};

export async function refreshOfficialRates(loanId: string, accessToken: string) {
  const response = await fetch("/api/rates/refresh", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ loanId }),
  });

  const body = await response.json() as OfficialRateRefresh | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Could not refresh official rates.");
  }

  return body as OfficialRateRefresh;
}

const RATE_CHECK_THROTTLE_MS = 6 * 60 * 60 * 1_000;

function rateCheckKey(loanId: string) {
  return `official-rate-check:${loanId}`;
}

export function isRateCheckDue(loanId: string) {
  try {
    const lastChecked = Number(window.localStorage.getItem(rateCheckKey(loanId)) ?? 0);
    return Date.now() - lastChecked >= RATE_CHECK_THROTTLE_MS;
  } catch {
    return true;
  }
}

export function markRateChecked(loanId: string) {
  try {
    window.localStorage.setItem(rateCheckKey(loanId), String(Date.now()));
  } catch {
    // Storage can be unavailable in private windows; the check simply runs again next time.
  }
}

// Forces a fresh official-rate check on the next dashboard visit, e.g. after loan terms change.
export function clearRateCheck(loanId: string) {
  try {
    window.localStorage.removeItem(rateCheckKey(loanId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
