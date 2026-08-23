import { useEffect, useRef, useState } from "react";

import { isDemoModeEnabled } from "@/services/demo-mode";
import {
  subscribeCentralRealtime,
  type RealtimeStatus,
} from "@/services/realtime-service";

export type CentralRealtimeStatus = RealtimeStatus | "desativado";

/**
 * Assina o realtime das tabelas existentes de sessões e alertas.
 *
 * Um único canal compartilhado por chave lógica, com desinscrição no unmount —
 * sem loop de reconexão. No modo demonstração o realtime fica desativado.
 */
export function useCentralRealtime(onChange: () => void) {
  const [status, setStatus] = useState<CentralRealtimeStatus>(
    isDemoModeEnabled() ? "desativado" : "conectando",
  );
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (isDemoModeEnabled()) {
      setStatus("desativado");
      return;
    }
    const subscription = subscribeCentralRealtime({
      key: "operacao",
      tables: [{ table: "protection_sessions" }, { table: "alerts" }],
      onChange: () => handler.current(),
      onStatus: setStatus,
    });
    return () => subscription.unsubscribe();
  }, []);

  return { status };
}
