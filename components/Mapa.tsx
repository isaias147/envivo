"use client";

// El mapa vive solo en el navegador: Leaflet necesita `window`.
// En app/page.tsx se importa con next/dynamic y ssr:false.

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { horaCali, type EventoPublico } from "@/lib/eventos";

type Props = {
  eventos: EventoPublico[];
  centro: { lat: number; lng: number };
  radioKm: number;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
};

function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;"
    : c === "<" ? "&lt;"
    : c === ">" ? "&gt;"
    : c === '"' ? "&quot;"
    : "&#39;",
  );
}

// Nivel de zoom según el radio elegido.
function zoomPorRadio(radioKm: number): number {
  if (radioKm <= 1) return 15;
  if (radioKm <= 3) return 14;
  return 13;
}

/**
 * El pin del mockup: una etiqueta con hora + nombre y un pie.
 * Hueso normal, verde si es gratis, latón si está seleccionado.
 */
function chinche(ev: EventoPublico, activo: boolean): L.DivIcon {
  const { hhmm } = horaCali(ev.starts_at);
  const nombre =
    ev.title.length > 20 ? `${ev.title.slice(0, 20).trim()}…` : ev.title;
  const fondo = activo ? "#FFB627" : ev.is_free ? "#5FD6A0" : "#F4F1E8";
  const tamHora = activo ? 13 : 11.5;
  const tamNombre = activo ? 12 : 11;
  const anchoMax = activo ? 168 : 132;
  const pad = activo ? "5px 10px" : "4px 8px";
  const altoPie = activo ? 15 : 11;

  const html = `
    <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);
                display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="font-family:var(--fuente-titulo),sans-serif;font-weight:700;
                  font-size:${tamHora}px;letter-spacing:-.01em;background:${fondo};
                  color:#161A3D;padding:${pad};border-radius:5px;display:flex;
                  align-items:baseline;gap:6px;max-width:${anchoMax}px;
                  box-shadow:0 2px 8px rgba(0,0,0,.35);">
        <span>${escaparHtml(hhmm)}</span>
        <span style="font-family:var(--fuente-cuerpo),sans-serif;font-weight:500;
                     font-size:${tamNombre}px;overflow:hidden;text-overflow:ellipsis;
                     white-space:nowrap;opacity:${activo ? 1 : 0.78};">${escaparHtml(nombre)}</span>
      </div>
      <div style="width:1px;height:${altoPie}px;background:${fondo};"></div>
    </div>`;

  return L.divIcon({ html, className: "", iconSize: [0, 0], iconAnchor: [0, 0] });
}

/** Mueve y ajusta el zoom del mapa cuando cambia el centro o el radio. */
function Vista({
  centro,
  zoom,
}: {
  centro: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([centro.lat, centro.lng], zoom, { animate: true });
  }, [centro.lat, centro.lng, zoom, map]);
  return null;
}

/** Leaflet mide mal el contenedor si se monta dentro de un flex; lo recalculamos. */
function AjustarTamano() {
  const map = useMap();
  useEffect(() => {
    const ajustar = () => map.invalidateSize();
    const t = setTimeout(ajustar, 0);
    window.addEventListener("resize", ajustar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", ajustar);
    };
  }, [map]);
  return null;
}

export default function Mapa({
  eventos,
  centro,
  radioKm,
  seleccionadoId,
  onSeleccionar,
}: Props) {
  const zoom = zoomPorRadio(radioKm);

  // Leaflet no tolera el doble montaje de React StrictMode en desarrollo:
  // esperamos un tick para montar el mapa una sola vez sobre un nodo limpio.
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setListo(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!listo) return null;

  return (
    <MapContainer
      center={[centro.lat, centro.lng]}
      zoom={zoom}
      zoomControl={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {/* Radio de búsqueda y "tú estás aquí". */}
      <Circle
        center={[centro.lat, centro.lng]}
        radius={radioKm * 1000}
        pathOptions={{
          color: "#FFB627",
          weight: 1,
          opacity: 0.5,
          fillColor: "#FFB627",
          fillOpacity: 0.05,
          dashArray: "3 6",
        }}
      />
      <CircleMarker
        center={[centro.lat, centro.lng]}
        radius={6}
        pathOptions={{
          color: "#FFB627",
          weight: 2,
          fillColor: "#FFB627",
          fillOpacity: 1,
        }}
      />

      {eventos.map((ev) => (
        <Marker
          key={ev.id}
          position={[ev.latitude, ev.longitude]}
          icon={chinche(ev, ev.id === seleccionadoId)}
          zIndexOffset={ev.id === seleccionadoId ? 1000 : 0}
          eventHandlers={{ click: () => onSeleccionar(ev.id) }}
        />
      ))}

      <Vista centro={centro} zoom={zoom} />
      <AjustarTamano />
    </MapContainer>
  );
}
