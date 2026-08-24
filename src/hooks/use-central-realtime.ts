import { useEffect, useRef, useState } from "react";

import { subscribeCentralRealtime, type RealtimeStatus } from "@/services/realtime-service";

export type CentralRealtimeStatus = RealtimeStatus;

/** Canal único da operação: ambas as telas compartilham a mesma assinatura. */
export function useCentralRealtime(onChange: () => void) {
  const [status, setStatus] = useState<CentralRealtimeStatus>("conectando");
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    const subscription = subscribeCentralRealtime({
      key: "operacao",
      tables: [
        { table: "protection_sessions", event: "*" },
        { table: "security_alerts", event: "*" },
        { table: "drivers", event: "*" },
        { table: "vehicles", event: "*" },
        { table: "central_operator_presence", event: "*" },
      ],
      onChange: () => handler.current(),
      onStatus: setStatus,
    });
    return () => subscription.unsubscribe();
  }, []);

  return { status };
}
