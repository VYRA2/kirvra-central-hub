/// <reference types="google.maps" />

import { useEffect, useMemo, useRef } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

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
  normal: "#3ddc97",
  atencao: "#f2b705",
  suspeito: "#f2b705",
  critico: "#ef4444",
};

const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };

// A chave é pública por design e protegida por restrição de domínio no Google Cloud
// (Application restrictions → HTTP referrers), não por sigilo — por isso pode
// ser usada diretamente no navegador, sem passar por segredo de servidor.
const GOOGLE_MAPS_API_KEY = 'AIzaSyB7h4e0rxDFcZYdES85K2Kqk0uVJHpS0uc';

function pinIcon(marker: GeoMarker): google.maps.Icon {
  const color = RISK_COLOR[marker.risk ?? "normal"] ?? RISK_COLOR["normal"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="11" fill="${color}" stroke="rgba(10,20,24,0.9)" stroke-width="2" opacity="${marker.offline ? 0.55 : 1}"/></svg>`;
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(26, 26),
    anchor: new google.maps.Point(13, 13),
  };
}

function ViewController({ markers, activeId }: { markers: GeoMarker[]; activeId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (markers.length === 0) {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(11);
      return;
    }

    const active = activeId ? markers.find((marker) => marker.id === activeId) : null;
    if (active) {
      map.panTo({ lat: active.latitude, lng: active.longitude });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    markers.forEach((marker) => bounds.extend({ lat: marker.latitude, lng: marker.longitude }));
    map.fitBounds(bounds, 48);
  }, [map, markers, activeId]);

  return null;
}

function TrackPolyline({ track }: { track: Array<[number, number]> }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || track.length < 2) return;

    const polyline = new google.maps.Polyline({
      path: track.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: "#3ddc97",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map,
    });
    polylineRef.current = polyline;

    return () => {
      polyline.setMap(null);
      polylineRef.current = null;
    };
  }, [map, track]);

  return null;
}

function GoogleMap({
  markers,
  activeId,
  track,
  onSelect,
}: {
  markers: GeoMarker[];
  activeId: string | null;
  track?: Array<[number, number]> | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const initialCenter = useMemo(() => {
    const first = markers[0];
    return first ? { lat: first.latitude, lng: first.longitude } : DEFAULT_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Map
      defaultCenter={initialCenter}
      defaultZoom={markers.length > 0 ? 13 : 11}
      style={{ width: "100%", height: "100%" }}
      disableDefaultUI
      zoomControl
      gestureHandling="greedy"
      clickableIcons={false}
    >
      {track && track.length > 1 ? <TrackPolyline track={track} /> : null}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={{ lat: marker.latitude, lng: marker.longitude }}
          icon={pinIcon(marker)}
          label={{
            text: marker.initials,
            color: "#04131a",
            fontSize: "10px",
            fontWeight: "700",
          }}
          title={marker.label}
          onClick={() => onSelect?.(marker.id)}
        />
      ))}
      <ViewController markers={markers} activeId={activeId} />
    </Map>
  );
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
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={[]}>
      <GoogleMap markers={markers} activeId={activeId} track={track} onSelect={onSelect} />
    </APIProvider>
  );
}
