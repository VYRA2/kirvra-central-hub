import { useEffect, useState } from "react";

import {
  getSession,
  hydrateSession,
  isBackendAvailable,
  subscribeSession,
  type CentralSession,
} from "@/services/auth-service";

export function useAuth() {
  const [session, setSession] = useState<CentralSession | null>(() =>
    getSession(),
  );
  const [ready, setReady] = useState(typeof window !== "undefined");

  useEffect(() => {
    setSession(hydrateSession());
    setReady(true);
    return subscribeSession(setSession);
  }, []);

  return {
    session,
    employee: session?.employee ?? null,
    ready,
    backendAvailable: isBackendAvailable(),
  };
}
