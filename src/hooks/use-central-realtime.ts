import { useEffect, useRef, useState } from "react";

import { isDemoModeEnabled } from "@/services/demo-mode";
import {
  subscribeCentralRealtime,
  type RealtimeStatus,
} from "@/services/realtime-service";

/**
 * Assina o realtime das tabelas existentes de sessões e alertas.
 *
 * Um único canal por montagem, com desinscrição no unmount — sem loop de
 * reconexão. No modo demonstração o realtime fica desativado por definição.
 */
export function useCentralRealtime(onChange: () => void) {
  const [status, setStatus] = useState<RealtimeStatus>(
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
      onChange: () => handler.current(),
      onStatus: setStatus,
    });
    return () => subscription.unsubscribe();
  }, []);

  return { status };
}
