// Tiles del mapa · "World Dark Gray Base" de Esri (arcgisonline.com).
//
// Por qué esta y no otra: es gratuita y NO pide API key, es oscura y
// minimalista (pega con el índigo de la app) y no lleva marca de agua.
// CARTO, que usábamos antes, ahora estampa "API KEY REQUIRED" en cada tile.
//
// Límite: solo tiene detalle nativo hasta zoom 16. Más allá, Leaflet reescala
// las tiles de z16 (se ven algo borrosas, pero sin huecos en blanco ni marca
// de agua). De ahí `maxNativeZoom` 16 y `maxZoom` 19.

export const TILES_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const TILES_ATRIBUCION =
  "&copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors";

export const TILES_MAX_NATIVE_ZOOM = 16;
export const TILES_MAX_ZOOM = 19;
