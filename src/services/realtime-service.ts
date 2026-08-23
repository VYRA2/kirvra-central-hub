/**
 * Canais Realtime da Central (Supabase VYRA2).
 *
 * Regras aplicadas:
 *  - um único canal por chave lógica (dedupe por contador de referências);
 *  - remoção do canal quando o último assinante desmonta;
 *  - nenhum polling, nenhum loop de reinscrição;
 *  - reconexão delegada ao cliente Supabase, com status reportado à interface;
 *  - falhas registradas sem expor tokens.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import { getVyraClient } from "@/integrations/vyra/client";

export type RealtimeStatus =
  | "indisponivel"
  | "conectando"
  | "conectado"
  | "reconectando"
  | "erro";

export interface RealtimeTableSpec {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
}

interface Entry {
  channel: RealtimeChannel;
  refs: number;
  status: RealtimeStatus;
  listeners: Set<(status: RealtimeStatus) => void>;
  changeListeners: Set<() => void>;
}

const entries = new Map<string, Entry>();

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export function subscribeCentralRealtime(options: {
  key: string;
  tables: RealtimeTableSpec[];
  onChange: () => void;
  onStatus?: (status: RealtimeStatus) => void;
}): RealtimeSubscription {
  const client = getVyraClient();
  if (!client) {
    options.onStatus?.("indisponivel");
    return { unsubscribe: () => {} };
  }

  let entry = entries.get(options.key);

  if (!entry) {
    const channel = client.channel(`kirvra-central:${options.key}`);
    const created: Entry = {
      channel,
      refs: 0,
      status: "conectando",
      listeners: new Set(),
      changeListeners: new Set(),
    };

    for (const spec of options.tables) {
      channel.on(
        "postgres_changes",
        { event: spec.event ?? "*", schema: "public", table: spec.table },
        () => {
          created.changeListeners.forEach((listener) => listener());
        },
      );
    }

    channel.subscribe((status) => {
      const next: RealtimeStatus =
        status === "SUBSCRIBED"
          ? "conectado"
          : status === "CHANNEL_ERROR"
            ? "erro"
            : status === "CLOSED"
              ? "reconectando"
              : "conectando";
      created.status = next;
      created.listeners.forEach((listener) => listener(next));
      if (next === "erro") {
        // Nunca registrar token/apikey: apenas o identificador do canal.
        console.warn(`[central] canal realtime com erro: ${options.key}`);
      }
    });

    entries.set(options.key, created);
    entry = created;
  }

  entry.refs += 1;
  entry.changeListeners.add(options.onChange);
  if (options.onStatus) {
    entry.listeners.add(options.onStatus);
    options.onStatus(entry.status);
  }

  let released = false;
  return {
    unsubscribe: () => {
      if (released) return;
      released = true;
      const current = entries.get(options.key);
      if (!current) return;
      current.changeListeners.delete(options.onChange);
      if (options.onStatus) current.listeners.delete(options.onStatus);
      current.refs -= 1;
      if (current.refs <= 0) {
        entries.delete(options.key);
        void client.removeChannel(current.channel);
      }
    },
  };
}
