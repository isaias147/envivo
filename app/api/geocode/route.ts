// GET /api/geocode?q=...
//
// Proxy al buscador de Nominatim (OpenStreetMap) para el campo "busca una
// ciudad o lugar" del formulario de /publicar/nuevo. Se hace en el servidor
// a propósito:
//   - El navegador no deja fijar el header `User-Agent`, que la política de
//     uso de Nominatim exige.
//   - Así centralizamos el respeto al límite (el debounce de 800 ms vive en
//     el cliente; aquí además cacheamos la respuesta).
//
// Devuelve { resultados: [{ place_id, display_name, lat, lon }] } (máx. 5).

import { NextResponse } from "next/server";

// Identifica la app ante Nominatim, con una URL de contacto (su política pide
// poder identificar quién hace las peticiones).
const USER_AGENT = "EnVivo/1.0 (PWA de eventos en vivo en Cali; https://envivo.app)";

type FilaNominatim = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ resultados: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "es");

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Una misma búsqueda de ciudad cambia poquísimo: cachea un día.
      next: { revalidate: 86400 },
    });
    if (!r.ok) {
      return NextResponse.json({ resultados: [] }, { status: 502 });
    }

    const datos = (await r.json()) as FilaNominatim[];
    const resultados = (datos ?? []).slice(0, 5).map((d) => ({
      place_id: d.place_id,
      display_name: d.display_name,
      lat: d.lat,
      lon: d.lon,
    }));
    return NextResponse.json({ resultados });
  } catch {
    return NextResponse.json({ resultados: [] }, { status: 502 });
  }
}
