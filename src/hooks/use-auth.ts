import { useEffect, useState } from "react";

import {
  getSession,
  isBackendAvailable,
  isDemoAvailable,
  resolveCentralSession,
  subscribeSession,
  type CentralSession,
} from "@/services/auth-service";

export function useAuth() {
  const [session, setSession] = useState<CentralSession | null>(() =>
    getSession(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeSession(setSession);
    void resolveCentralSession().then((resolved) => {
      if (!active) return;
      setSession(resolved);
      setReady(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    session,
    employee: session?.employee ?? null,
    ready,
    loading: !ready,
    backendAvailable: isBackendAvailable(),
    demoMode: isDemoAvailable(),
  };
}
