// POST /api/publicador/evento/editar
//
// Sesión 13, paso 6. Deja que el dueño de un perfil edite el flyer, el
// video y la ubicación de un evento suyo YA PUBLICADO, sin pasar por
// re-revisión (ese modelo se reemplaza en la Sesión 18). Se guarda directo.
//
// - Auth: cookie `envivo_publicador`. Solo se puede editar un evento cuyo
//   `perfil_id` coincida con el de la sesión.
// - Reubicación: si el pin nuevo está a más de `REUBICACION_METROS` del
//   original, se marca `events.reubicado_pendiente = true`. No bloquea el
//   guardado; solo se detecta. El conteo (veces_movido, aviso) es de S18.
// - Series: flyer/video/ubicación son propios del evento entero, así que si
//   la fila pertenece a una serie se actualizan todas sus fechas.
// - Nombre, hora y descripción NO se tocan acá.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { distanciaMetros, REUBICACION_METROS } from "@/lib/eventos";
import { leerSesionPublicador } from "@/lib/sesionPublicador";

const RE_REEL = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i;

/** Normaliza el link del video: null si vacío, `false` si no es IG/TikTok. */
function normalizarVideo(valor: unknown): string | null | false {
  const v = String(valor ?? "").trim();
  if (!v) return null;
  let url = v;
  if (url.startsWith("http://")) url = "https://" + url.slice(7);
  else if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return RE_REEL.test(url) ? url : false;
}

export async function POST(request: Request) {
  const sesion = await leerSesionPublicador();
  if (!sesion?.perfilId) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let cuerpo: {
    id?: string;
    coverUrl?: string | null;
    postUrl?: string | null;
    latitude?: number;
    longitude?: number;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const id = String(cuerpo.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "Falta el evento." }, { status: 400 });
  }

  const { data: evento } = await supabaseServidor
    .from("events")
    .select("id, perfil_id, series_id, latitude, longitude")
    .eq("id", id)
    .maybeSingle();

  if (!evento) {
    return NextResponse.json({ error: "No existe ese evento." }, { status: 404 });
  }
  if (evento.perfil_id !== sesion.perfilId) {
    return NextResponse.json(
      { error: "Ese evento no es tuyo." },
      { status: 403 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Flyer: solo se cambia si mandan una URL nueva. No se permite dejarlo
  // vacío (el flyer es obligatorio en toda la app).
  const coverUrl = String(cuerpo.coverUrl ?? "").trim();
  if (coverUrl) patch.cover_url = coverUrl;

  // Video: opcional; se puede borrar mandando cadena vacía.
  if (cuerpo.postUrl !== undefined) {
    const video = normalizarVideo(cuerpo.postUrl);
    if (video === false) {
      return NextResponse.json(
        { error: "El link del video debe ser de Instagram o TikTok." },
        { status: 400 },
      );
    }
    patch.post_url = video;
  }

  // Ubicación + detección de reubicación.
  let reubicado = false;
  const lat = Number(cuerpo.latitude);
  const lng = Number(cuerpo.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    patch.latitude = lat;
    patch.longitude = lng;

    if (evento.latitude != null && evento.longitude != null) {
      const metros = distanciaMetros(
        { lat: evento.latitude, lng: evento.longitude },
        { lat, lng },
      );
      if (metros > REUBICACION_METROS) {
        reubicado = true;
        patch.reubicado_pendiente = true; // solo se marca, nunca se limpia acá
      }
    }
  }

  // Si es serie, el cambio aplica a todas sus fechas.
  const consulta = supabaseServidor
    .from("events")
    .update(patch, { count: "exact" });
  const { error, count } = evento.series_id
    ? await consulta.eq("series_id", evento.series_id)
    : await consulta.eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, reubicado, filas: count ?? 1 });
}
