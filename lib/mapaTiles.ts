// Tiles del mapa · Stadia Maps "Alidade Smooth Dark" (modo oscuro) y su
// variante clara "Alidade Smooth" (modo claro del sistema, useTilesUrl).
//
// Estilo oscuro nativo ("negro suave"), sin necesidad de filtros CSS: las
// tiles ya vienen en la paleta correcta y combinan con el fondo índigo de
// la app. Antes se usaba "OSM Bright" (un estilo claro) invertido con
// `filter: invert(1) hue-rotate(180deg)...` sobre `.leaflet-tile-pane`; ese
// truco se retiró al pasar al estilo oscuro nativo.
//
// Necesita una API key de Stadia en `NEXT_PUBLIC_STADIA_API_KEY` (.env.local
// y variables de entorno de Netlify). Tiene detalle nativo hasta zoom 20,
// así que no hace falta que Leaflet reescale tiles.

import { useSyncExternalStore } from "react";

const tilesUrl = (estilo: string) =>
  `https://tiles.stadiamaps.com/tiles/${estilo}/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`;

const CLARO = "(prefers-color-scheme: light)";

/** URL de tiles según el modo del sistema; cambia en vivo si el usuario
 * cambia de modo (TileLayer hace setUrl sin rearmar el mapa). */
export function useTilesUrl(): string {
  const claro = useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CLARO);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CLARO).matches,
    () => false,
  );
  return tilesUrl(claro ? "alidade_smooth" : "alidade_smooth_dark");
}

export const TILES_ATRIBUCION =
  "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors";

export const TILES_MAX_NATIVE_ZOOM = 20;
export const TILES_MAX_ZOOM = 19;
