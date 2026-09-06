"use client";

// El mapa vive solo en el navegador: Leaflet necesita `window`.
// En app/page.tsx se importa con next/dynamic y ssr:false.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { horaCali, type EventoPublico } from "@/lib/eventos";
import {
  TILES_ATRIBUCION,
  TILES_MAX_NATIVE_ZOOM,
  TILES_MAX_ZOOM,
  TILES_URL,
} from "@/lib/mapaTiles";

type Props = {
  eventos: EventoPublico[];
  centro: { lat: number; lng: number };
  radioKm: number;
  /** true si el punto sigue en la ubicación real (el mapa lo recentra). */
  anclado: boolean;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  onMoverCentro: (lat: number, lng: number) => void;
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

// Punto de referencia arrastrable: un aro latón sobre un núcleo latón.
const ICONO_UBICACION = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `
    <div style="width:24px;height:24px;border-radius:50%;
                background:rgba(255,182,39,.22);display:flex;
                align-items:center;justify-content:center;cursor:grab;">
      <div style="width:12px;height:12px;border-radius:50%;background:#FFB627;
                  border:2px solid var(--noche);
                  box-shadow:0 0 0 1px rgba(255,182,39,.6);"></div>
    </div>`,
});

/**
 * El pin del mockup: una etiqueta con hora + nombre y un pie.
 * Índigo normal, verde si es gratis, latón si está seleccionado.
 */
function chinche(ev: EventoPublico, activo: boolean): L.DivIcon {
  const { hhmm } = horaCali(ev.starts_at);
  const nombre =
    ev.title.length > 20 ? `${ev.title.slice(0, 20).trim()}…` : ev.title;
  const fondo = activo ? "#FFB627" : ev.is_free ? "#5FD6A0" : "#161A3D";
  // Sobre latón o verde el texto va índigo; sobre el índigo normal, hueso.
  const texto = activo || ev.is_free ? "#161A3D" : "#F4F1E8";
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
                  color:${texto};padding:${pad};border-radius:5px;display:flex;
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

/**
 * Recentra y ajusta el zoom del mapa cuando el punto está anclado a la
 * ubicación real. Si el usuario lo recolocó a mano, solo ajusta el zoom
 * y respeta dónde dejó el punto.
 */
function Vista({
  centro,
  zoom,
  anclado,
}: {
  centro: { lat: number; lng: number };
  zoom: number;
  anclado: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (anclado) {
      map.setView([centro.lat, centro.lng], zoom, { animate: true });
    } else {
      map.setZoom(zoom);
    }
  }, [centro.lat, centro.lng, zoom, anclado, map]);
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

/**
 * Mantener pulsado ~0,5 s sobre el mapa recoloca el punto ahí.
 * También responde a `contextmenu` (el long-press del móvil y el clic
 * derecho en escritorio). Se cancela si el gesto empieza sobre un pin
 * o si el dedo se mueve (eso es un desplazamiento del mapa).
 */
function PulsacionLarga({
  onMover,
}: {
  onMover: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let inicio: L.Point | null = null;

    const cancelar = () => {
      if (temporizador) {
        clearTimeout(temporizador);
        temporizador = null;
      }
      inicio = null;
    };

    const sobreUnPin = (e: L.LeafletMouseEvent) => {
      const t = e.originalEvent?.target as HTMLElement | null;
      return !!t?.closest?.(".leaflet-marker-icon");
    };

    const alPresionar = (e: L.LeafletMouseEvent) => {
      if (sobreUnPin(e)) return;
      inicio = e.containerPoint;
      const { lat, lng } = e.latlng;
      temporizador = setTimeout(() => {
        temporizador = null;
        onMover(lat, lng);
      }, 500);
    };

    const alMover = (e: L.LeafletMouseEvent) => {
      if (inicio && inicio.distanceTo(e.containerPoint) > 8) cancelar();
    };

    const alMenuContexto = (e: L.LeafletMouseEvent) => {
      if (sobreUnPin(e)) return;
      L.DomEvent.preventDefault(e.originalEvent);
      onMover(e.latlng.lat, e.latlng.lng);
    };

    map.on("mousedown", alPresionar);
    map.on("mousemove", alMover);
    map.on("mouseup", cancelar);
    map.on("dragstart", cancelar);
    map.on("zoomstart", cancelar);
    map.on("contextmenu", alMenuContexto);
    return () => {
      cancelar();
      map.off("mousedown", alPresionar);
      map.off("mousemove", alMover);
      map.off("mouseup", cancelar);
      map.off("dragstart", cancelar);
      map.off("zoomstart", cancelar);
      map.off("contextmenu", alMenuContexto);
    };
  }, [map, onMover]);
  return null;
}

export default function Mapa({
  eventos,
  centro,
  radioKm,
  anclado,
  seleccionadoId,
  onSeleccionar,
  onMoverCentro,
}: Props) {
  const zoom = zoomPorRadio(radioKm);

  return (
    <MapContainer
      center={[centro.lat, centro.lng]}
      zoom={zoom}
      zoomControl={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <TileLayer
        url={TILES_URL}
        attribution={TILES_ATRIBUCION}
        maxNativeZoom={TILES_MAX_NATIVE_ZOOM}
        maxZoom={TILES_MAX_ZOOM}
      />

      {/* Radio de búsqueda alrededor del punto de referencia. */}
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

      {/* Punto de referencia: se arrastra para recolocarlo. */}
      <Marker
        position={[centro.lat, centro.lng]}
        icon={ICONO_UBICACION}
        draggable
        autoPan
        zIndexOffset={2000}
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng();
            onMoverCentro(ll.lat, ll.lng);
          },
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

      <Vista centro={centro} zoom={zoom} anclado={anclado} />
      <PulsacionLarga onMover={onMoverCentro} />
      <AjustarTamano />
    </MapContainer>
  );
}
