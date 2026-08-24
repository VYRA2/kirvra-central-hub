/**
 * Wrapper isomórfico do mapa real.
 *
 * SSR nunca avalia `leaflet`: o módulo entra por React.lazy dentro de
 * <ClientOnly>. Estados obrigatórios: carregando, vazio (sem localização
 * válida) e falha de carregamento do mapa.
 */
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GeoMarker } from "./geo-map";

const GeoMap = lazy(() => import("./geo-map"));

function Frame({ className, children }: { className?: string | undefined; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative min-h-[320px] w-full overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function GeoMapPanel({
  markers,
  activeId = null,
  track,
  onSelect,
  overlay,
  className,
}: {
  markers: GeoMarker[];
  activeId?: string | null;
  track?: Array<[number, number]> | undefined;
  onSelect?: ((id: string) => void) | undefined;
  overlay?: ReactNode;
  className?: string | undefined;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (String(event.message).toLowerCase().includes("leaflet")) {
        setFailed(true);
      }
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  if (failed) {
    return (
      <Frame className={className}>
        <Centered>
          <TriangleAlert className="h-5 w-5 text-warning" aria-hidden="true" />
          Não foi possível carregar o mapa. Verifique a conexão com o provedor de tiles e tente
          novamente.
        </Centered>
      </Frame>
    );
  }

  return (
    <Frame className={className}>
      <div className="absolute inset-0">
        <ClientOnly fallback={<Centered>Carregando mapa operacional…</Centered>}>
          <Suspense fallback={<Centered>Carregando mapa operacional…</Centered>}>
            <GeoMap markers={markers} activeId={activeId} track={track} onSelect={onSelect} />
          </Suspense>
        </ClientOnly>
      </div>
      {markers.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-md border border-border bg-card/85 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          Nenhuma sessão com localização válida no momento
        </div>
      ) : null}
      {overlay}
    </Frame>
  );

}
