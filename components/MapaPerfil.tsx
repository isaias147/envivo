"use client";

// Mini-mapa de la sección "Próximos eventos" del perfil público.
// Muestra un pin latón por cada evento futuro del perfil. Es una foto: no
// se arrastra, no hace zoom, no responde a clics. Se importa con
// next/dynamic y ssr:false porque Leaflet necesita `window`.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  TILES_ATRIBUCION,
  TILES_MAX_NATIVE_ZOOM,
  TILES_MAX_ZOOM,
  TILES_URL,
} from "@/lib/mapaTiles";

export type PuntoPerfil = { id: string; lat: number; lng: number };

const PIN = L.divIcon({
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#FFB627;
              border:2px solid #161A3D;box-shadow:0 0 0 1px rgba(255,182,39,.7)"></div>`,
});

/** Encuadra el mapa sobre todos los puntos (o fija el zoom si hay uno solo). */
function Encuadrar({ puntos }: { puntos: PuntoPerfil[] }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
      if (puntos.length === 1) {
        map.setView([puntos[0].lat, puntos[0].lng], 15);
      } else if (puntos.length > 1) {
        const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
        map.fitBounds(limites, { padding: [20, 20], maxZoom: 15 });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [map, puntos]);
  return null;
}

export default function MapaPerfil({ puntos }: { puntos: PuntoPerfil[] }) {
  const centro = puntos[0] ?? { lat: 3.4516, lng: -76.532 }; // Cali por defecto

  return (
    <MapContainer
      center={[centro.lat, centro.lng]}
      zoom={13}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      boxZoom={false}
      keyboard={false}
      touchZoom={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <TileLayer
        url={TILES_URL}
        attribution={TILES_ATRIBUCION}
        maxNativeZoom={TILES_MAX_NATIVE_ZOOM}
        maxZoom={TILES_MAX_ZOOM}
      />
      {puntos.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={PIN} />
      ))}
      <Encuadrar puntos={puntos} />
    </MapContainer>
  );
}
