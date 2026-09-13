/**
 * Mapa real (MapLibre GL JS nativo + OpenFreeMap).
 *
 * Módulo carregado APENAS no navegador (React.lazy dentro de <ClientOnly>
 * no geo-map-panel.tsx), porque maplibre-gl toca `window` no import.
 * Nenhuma coordenada é inventada: o componente recebe somente sessões
 * com ponto válido.
 */
import { useEffect, useMemo, useRef } from "react";
import { Layer, Map, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

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

const DEFAULT_CENTER: [number, number] = [-46.6333, -23.5505];

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
  const mapRef = useRef<MapRef | null>(null);

  const initialViewState = useMemo(() => {
    const first = markers[0];
    return {
      longitude: first ? first.longitude : DEFAULT_CENTER[0],
      latitude: first ? first.latitude : DEFAULT_CENTER[1],
      zoom: markers.length > 0 ? 13 : 11,
    };
    // A posição inicial é capturada somente na montagem; mudanças posteriores
    // são tratadas pelo efeito de enquadramento abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markers.length === 0) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: 11, duration: 0 });
      return;
    }

    const active = activeId ? markers.find((marker) => marker.id === activeId) : null;
    if (active) {
      map.flyTo({ center: [active.longitude, active.latitude], zoom: 15, duration: 600 });
      return;
    }

    const lngs = markers.map((marker) => marker.longitude);
    const lats = markers.map((marker) => marker.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 15, duration: 600 },
    );
  }, [markers, activeId]);

  const trackGeoJson = useMemo(() => {
    if (!track || track.length < 2) return null;
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: track.map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    };
  }, [track]);

  return (
    <Map
      ref={mapRef}
      initialViewState={initialViewState}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
    >
      {trackGeoJson ? (
        <Source id="track" type="geojson" data={trackGeoJson}>
          <Layer
            id="track-line"
            type="line"
            paint={{
              "line-color": "oklch(0.789 0.148 173)",
              "line-width": 3,
              "line-dasharray": [2, 1.5],
            }}
          />
        </Source>
      ) : null}
      {markers.map((marker) => {
        const color = RISK_COLOR[marker.risk ?? "normal"] ?? RISK_COLOR["normal"];
        return (
          <Marker
            key={marker.id}
            longitude={marker.longitude}
            latitude={marker.latitude}
            onClick={() => onSelect?.(marker.id)}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 9999,
                border: "2px solid rgba(10,20,24,0.9)",
                background: color,
                color: "#04131a",
                font: "700 10px/1 ui-sans-serif, system-ui",
                opacity: marker.offline ? 0.55 : 1,
                filter: marker.offline ? "grayscale(1)" : "none",
                cursor: "pointer",
              }}
              title={marker.label}
            >
              {marker.initials}
            </span>
          </Marker>
        );
      })}
    </Map>
  );
}