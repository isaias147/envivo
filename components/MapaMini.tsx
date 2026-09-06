"use client";

// Mini-mapa para las tarjetas del panel: muestra dónde cae el evento y un
// pin latón. Sin interacción (no se arrastra ni se hace zoom); es una foto.
// Se importa con next/dynamic y ssr:false porque Leaflet necesita `window`.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PIN = L.divIcon({
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#FFB627;
              border:2px solid #161A3D;box-shadow:0 0 0 1px rgba(255,182,39,.7)"></div>`,
});

function Recalcular() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function MapaMini({
  lat,
  lng,
  zoom = 15,
}: {
  lat: number;
  lng: number;
  zoom?: number;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
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
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Marker position={[lat, lng]} icon={PIN} />
      <Recalcular />
    </MapContainer>
  );
}
