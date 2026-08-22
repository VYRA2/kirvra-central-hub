import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/integrations/vyra/types";

const MARKER_TONE: Record<RiskLevel, string> = {
  normal: "bg-success text-success-foreground",
  atencao: "bg-warning text-warning-foreground",
  suspeito: "bg-warning text-warning-foreground",
  critico: "bg-critical text-critical-foreground",
};

export interface MapMarkerData {
  id: string;
  label: string;
  x: number;
  y: number;
  risk: RiskLevel;
  offline?: boolean;
}

export function MapMarker({
  marker,
  active,
  onSelect,
}: {
  marker: MapMarkerData;
  active?: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(marker.id)}
      aria-label={`Sessão de ${marker.label}${marker.offline ? " · offline" : ""}`}
      aria-pressed={active}
      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-0.5 transition-transform hover:scale-110",
        active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold",
          MARKER_TONE[marker.risk],
          marker.offline && "opacity-60 grayscale",
        )}
      >
        {marker.label.slice(0, 1)}
      </span>
      {marker.risk === "critico" && !marker.offline ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 animate-ping rounded-full bg-critical/50"
        />
      ) : null}
    </button>
  );
}

export function LiveMapPanel({
  markers,
  activeId,
  onSelect,
  track,
  overlay,
  footer,
  className,
}: {
  markers: MapMarkerData[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  track?: Array<{ x: number; y: number }>;
  overlay?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "kirvra-map-grid relative min-h-[280px] w-full overflow-hidden rounded-lg border border-border",
        className,
      )}
      role="img"
      aria-label={`Mapa operacional com ${markers.length} sessões monitoradas`}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 62 L36 44 L58 52 L100 30"
          fill="none"
          stroke="oklch(0.42 0.03 200)"
          strokeWidth="1.2"
        />
        <path
          d="M14 0 L26 40 L34 100"
          fill="none"
          stroke="oklch(0.4 0.03 200)"
          strokeWidth="1"
        />
        <path
          d="M78 0 L70 46 L86 100"
          fill="none"
          stroke="oklch(0.4 0.03 200)"
          strokeWidth="1"
        />
        <path
          d="M0 20 L100 84"
          fill="none"
          stroke="oklch(0.38 0.025 200)"
          strokeWidth="0.8"
        />
        {track && track.length > 1 ? (
          <polyline
            points={track.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="oklch(0.789 0.148 173)"
            strokeWidth="1.4"
            strokeDasharray="3 2"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      {markers.map((marker) => (
        <MapMarker
          key={marker.id}
          marker={marker}
          active={activeId === marker.id}
          onSelect={onSelect || (undefined as any)}
        />
      ))}

      {overlay}
      {footer ? (
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-card/85 px-3 py-2 backdrop-blur-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
