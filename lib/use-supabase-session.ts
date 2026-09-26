"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export function useSupabaseSession(onSignedOut?: () => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const onSignedOutRef = useRef(onSignedOut);

  useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: current }) => {
      setSession(current.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) onSignedOutRef.current?.();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, ready };
}
