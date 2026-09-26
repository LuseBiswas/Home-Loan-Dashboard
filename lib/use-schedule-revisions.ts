"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleRevision } from "@/lib/amortization";
import { loadScheduleRevisions } from "@/lib/loan-service";

// Keeps the last loaded revisions so revisiting a page renders instantly while it refreshes.
const revisionsCache = new Map<string, ScheduleRevision[]>();

export function useScheduleRevisions(loanId: string) {
  const [state, setState] = useState<{ loanId: string; items: ScheduleRevision[] } | null>(() => {
    const cached = revisionsCache.get(loanId);
    return cached ? { loanId, items: cached } : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    loadScheduleRevisions(loanId)
      .then((items) => {
        if (!active) return;
        revisionsCache.set(loanId, items);
        setError(null);
        setState({ loanId, items });
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load your schedule.");
      });

    return () => {
      active = false;
    };
  }, [loanId, refreshIndex]);

  const reload = useCallback(() => setRefreshIndex((value) => value + 1), []);
  const ready = state?.loanId === loanId;
  const revisions = useMemo(() => (ready ? state.items : []), [ready, state]);

  return { revisions, ready, error, reload };
}
