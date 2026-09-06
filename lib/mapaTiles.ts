// Tiles del mapa · Stadia Maps "OSM Bright".
//
// Estilo claro con buen detalle de calles. En el CSS de cada mapa se le
// aplica `filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9)`
// sobre `.leaflet-tile-pane` para volverlo oscuro y que combine con el
// fondo índigo (solo afecta a las tiles, no a los pines ni controles).
// Necesita una API key de Stadia en `NEXT_PUBLIC_STADIA_API_KEY` (.env.local
// y variables de entorno de Netlify). Tiene detalle nativo hasta zoom 20,
// así que no hace falta que Leaflet reescale tiles.

export const TILES_URL = `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`;

export const TILES_ATRIBUCION =
  "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors";

export const TILES_MAX_NATIVE_ZOOM = 20;
export const TILES_MAX_ZOOM = 19;
