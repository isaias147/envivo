// Tiles del mapa · Stadia Maps "OSM Bright".
//
// Estilo claro y con buen detalle de calles, sin filtro CSS encima.
// Necesita una API key de Stadia en `NEXT_PUBLIC_STADIA_API_KEY` (.env.local
// y variables de entorno de Netlify). Tiene detalle nativo hasta zoom 20,
// así que no hace falta que Leaflet reescale tiles.

export const TILES_URL = `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`;

export const TILES_ATRIBUCION =
  "&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap contributors";

export const TILES_MAX_NATIVE_ZOOM = 20;
export const TILES_MAX_ZOOM = 19;
