import { useEffect, useMemo, useState } from "react";

import type { PermissionCode } from "@/integrations/vyra/access";
import {
  getSession,
  isBackendAvailable,
  isDemoAvailable,
  resolveCentralSession,
  subscribeSession,
  type CentralSession,
} from "@/services/auth-service";

export interface UseAuthResult {
  session: CentralSession | null;
  employee: CentralSession["employee"] | null;
  role: CentralSession["role"] | null;
  permissions: PermissionCode[];
  ready: boolean;
  loading: boolean;
  backendAvailable: boolean;
  demoMode: boolean;
  isDemoSession: boolean;
  can: (permission: PermissionCode) => boolean;
  canAll: (permissions: PermissionCode[]) => boolean;
}

/**
 * Fonte única de sessão/cargo/permissões no cliente.
 * As permissões vêm do servidor (funções SECURITY DEFINER) e são usadas apenas
 * para decidir o que renderizar — a autorização real é garantida por RLS.
 */
export function useAuth(): UseAuthResult {
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

  const permissions = session?.permissions ?? [];

  return useMemo<UseAuthResult>(
    () => ({
      session,
      employee: session?.employee ?? null,
      role: session?.role ?? null,
      permissions,
      ready,
      loading: !ready,
      backendAvailable: isBackendAvailable(),
      demoMode: isDemoAvailable(),
      isDemoSession: session?.kind === "demo",
      can: (permission) => permissions.includes(permission),
      canAll: (required) =>
        required.every((permission) => permissions.includes(permission)),
    }),
    // permissions é derivado de session; a dependência é a própria sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, ready],
  );
}
