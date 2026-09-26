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
