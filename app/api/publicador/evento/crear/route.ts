// POST /api/publicador/evento/crear
//
// Publicar exige registro. Antes /publicar/nuevo insertaba directo en
// `events` con el cliente anónimo (política `events_anon_insert`, ya
// eliminada); ahora el INSERT pasa por acá con service_role.
//
// - Auth: cookie `envivo_publicador`. Sin sesión, 401.
// - `perfil_id`, `publisher_name` e `instagram`/`tiktok` NO se leen del
//   cuerpo: salen del perfil en la base. El navegador no puede publicar a
//   nombre de otro perfil aunque lo mande.
// - El resto de campos se copian tal cual los arma la pantalla.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionPublicador } from "@/lib/sesionPublicador";

type Fila = Record<string, unknown>;

export async function POST(request: Request) {
  const sesion = await leerSesionPublicador();
  if (!sesion?.perfilId) {
    return NextResponse.json(
      { error: "Necesitás una cuenta para publicar." },
      { status: 401 },
    );
  }

  let cuerpo: { filas?: Fila[] };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const filas = Array.isArray(cuerpo.filas) ? cuerpo.filas : [];
  if (filas.length === 0 || filas.length > 60) {
    return NextResponse.json(
      { error: "No hay fechas para publicar." },
      { status: 400 },
    );
  }

  // El perfil manda: nombre y redes salen de la base, no del navegador.
  const { data: perfil } = await supabaseServidor
    .from("perfiles")
    .select("id, nombre, tipo, instagram, tiktok, whatsapp_publico")
    .eq("id", sesion.perfilId)
    .maybeSingle();

  if (!perfil) {
    return NextResponse.json(
      { error: "No encontramos tu perfil." },
      { status: 403 },
    );
  }

  // Campos que solo el servidor decide.
  const impuestos = {
    perfil_id: perfil.id,
    publisher_name: perfil.nombre ?? null,
    // El tipo sale del perfil: no se elige al publicar (un artista no puede
    // publicar como organizador).
    publisher_type: perfil.tipo,
    instagram: perfil.instagram ?? null,
    tiktok: perfil.tiktok ?? null,
    status: "pendiente" as const,
    reviewed_at: null,
    city: "Cali",
  };

  const aInsertar = filas.map((f) => ({ ...f, ...impuestos }));

  const { error, count } = await supabaseServidor
    .from("events")
    .insert(aInsertar, { count: "exact" });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo enviar el evento. Intentá de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, filas: count ?? aInsertar.length });
}
