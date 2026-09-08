// Tiles del mapa · Stadia Maps "Alidade Smooth Dark".
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

export const TILES_URL = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`;

export const TILES_ATRIBUCION =
  "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors";

export const TILES_MAX_NATIVE_ZOOM = 20;
export const TILES_MAX_ZOOM = 19;
