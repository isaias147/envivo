"use client";

// Mini-mapa para marcar DÓNDE es el evento. Un solo pin, arrastrable.
// También se recoloca tocando el mapa o manteniendo pulsado (long-press).
// Vive solo en el navegador: Leaflet necesita `window`, así que en el
// formulario se importa con next/dynamic y ssr:false.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GRANADA_CALI } from "@/lib/eventos";

type Props = {
  /** Punto actual del pin. */
  punto: { lat: number; lng: number };
  /** El usuario ya recolocó el pin al menos una vez. */
  movido: boolean;
  /** Se llama con las nuevas coordenadas cada vez que el pin cambia. */
  onCambio: (lat: number, lng: number) => void;
};

// El pin del mockup: etiqueta latón "Aquí" con su pie.
const ICONO_AQUI = L.divIcon({
  className: "",
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  html: `
    <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);
                display:flex;flex-direction:column;align-items:center;cursor:grab;">
      <span style="font-family:var(--fuente-titulo),sans-serif;font-weight:700;
                   font-size:11px;background:#FFB627;color:#231A00;padding:4px 9px;
                   border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,.35);">Aquí</span>
      <span style="display:block;width:1px;height:13px;background:#FFB627;"></span>
    </div>`,
});

/** Leaflet mide mal el contenedor dentro de un flex/scroll; lo recalculamos. */
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
 * Recentra el mapa cuando el punto cambia desde fuera (p. ej. la
 * geolocalización lo movió), pero no mientras el usuario lo arrastra.
 */
function Seguir({
  punto,
  movido,
}: {
  punto: { lat: number; lng: number };
  movido: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!movido) map.setView([punto.lat, punto.lng], map.getZoom(), { animate: true });
  }, [punto.lat, punto.lng, movido, map]);
  return null;
}

/** Tocar el mapa (o mantener pulsado) recoloca el pin ahí. */
function TocarParaMover({ onMover }: { onMover: (lat: number, lng: number) => void }) {
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
    const sobrePin = (e: L.LeafletMouseEvent) => {
      const t = e.originalEvent?.target as HTMLElement | null;
      return !!t?.closest?.(".leaflet-marker-icon");
    };
    const alPresionar = (e: L.LeafletMouseEvent) => {
      if (sobrePin(e)) return;
      inicio = e.containerPoint;
      const { lat, lng } = e.latlng;
      temporizador = setTimeout(() => {
        temporizador = null;
        onMover(lat, lng);
      }, 450);
    };
    const alMover = (e: L.LeafletMouseEvent) => {
      if (inicio && inicio.distanceTo(e.containerPoint) > 8) cancelar();
    };
    const alSoltar = (e: L.LeafletMouseEvent) => {
      // Un toque corto y quieto también recoloca el pin.
      if (temporizador && inicio && inicio.distanceTo(e.containerPoint) <= 8) {
        onMover(e.latlng.lat, e.latlng.lng);
      }
      cancelar();
    };
    const alMenuContexto = (e: L.LeafletMouseEvent) => {
      if (sobrePin(e)) return;
      L.DomEvent.preventDefault(e.originalEvent);
      onMover(e.latlng.lat, e.latlng.lng);
    };

    map.on("mousedown", alPresionar);
    map.on("mousemove", alMover);
    map.on("mouseup", alSoltar);
    map.on("dragstart", cancelar);
    map.on("zoomstart", cancelar);
    map.on("contextmenu", alMenuContexto);
    return () => {
      cancelar();
      map.off("mousedown", alPresionar);
      map.off("mousemove", alMover);
      map.off("mouseup", alSoltar);
      map.off("dragstart", cancelar);
      map.off("zoomstart", cancelar);
      map.off("contextmenu", alMenuContexto);
    };
  }, [map, onMover]);
  return null;
}

export default function MapaSelector({ punto, movido, onCambio }: Props) {
  return (
    <MapContainer
      center={[punto.lat, punto.lng]}
      zoom={16}
      zoomControl={false}
      attributionControl={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Marker
        position={[punto.lat, punto.lng]}
        icon={ICONO_AQUI}
        draggable
        autoPan
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng();
            onCambio(ll.lat, ll.lng);
          },
        }}
      />
      <Seguir punto={punto} movido={movido} />
      <TocarParaMover onMover={onCambio} />
      <AjustarTamano />
    </MapContainer>
  );
}

export { GRANADA_CALI };
