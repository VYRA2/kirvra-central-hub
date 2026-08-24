/**
 * Mapa real (Leaflet + OpenStreetMap).
 *
 * Módulo carregado APENAS no navegador (React.lazy dentro de <ClientOnly>),
 * porque `leaflet` toca `window` no import. Nenhuma coordenada é inventada:
 * o componente recebe somente sessões com ponto válido.
 */
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

import type { RiskLevel } from "@/integrations/vyra/types";

export interface GeoMarker {
  id: string;
  label: string;
  initials: string;
  latitude: number;
  longitude: number;
  risk: RiskLevel | null;
  offline: boolean;
}

const RISK_COLOR: Record<string, string> = {
  normal: "oklch(0.789 0.148 173)",
  atencao: "oklch(0.79 0.16 82)",
  suspeito: "oklch(0.79 0.16 82)",
  critico: "oklch(0.63 0.22 22)",
};

function pinIcon(marker: GeoMarker) {
  const color = RISK_COLOR[marker.risk ?? "normal"] ?? RISK_COLOR["normal"];
  return L.divIcon({
    className: "kirvra-pin",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;border:2px solid rgba(10,20,24,0.9);background:${color};color:#04131a;font:700 10px/1 ui-sans-serif,system-ui;opacity:${marker.offline ? 0.55 : 1};filter:${marker.offline ? "grayscale(1)" : "none"}">${marker.initials}</span>`,
  });
}

function FitBounds({ markers, activeId }: { markers: GeoMarker[]; activeId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;
    const active = activeId ? markers.find((marker) => marker.id === activeId) : null;
    if (active) {
      map.setView([active.latitude, active.longitude], 15, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(
      markers.map((marker) => [marker.latitude, marker.longitude] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, markers, activeId]);

  return null;
}

export default function GeoMap({
  markers,
  activeId = null,
  track,
  onSelect,
}: {
  markers: GeoMarker[];
  activeId?: string | null;
  track?: Array<[number, number]> | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const center = useMemo<[number, number]>(() => {
    const first = markers[0];
    return first ? [first.latitude, first.longitude] : [-23.5505, -46.6333];
  }, [markers]);

  return (
    <MapContainer
      center={center}
      zoom={markers.length > 0 ? 13 : 11}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl={false}
      preferCanvas
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      {track && track.length > 1 ? (
        <Polyline
          positions={track}
          pathOptions={{ color: "oklch(0.789 0.148 173)", weight: 3, dashArray: "6 4" }}
        />
      ) : null}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={pinIcon(marker)}
          title={marker.label}
          eventHandlers={{
            click: () => onSelect?.(marker.id),
          }}
        />
      ))}
      <FitBounds markers={markers} activeId={activeId} />
    </MapContainer>
  );
}
