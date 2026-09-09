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
// - Sesión 18: el evento sale PUBLICADO. La base pone `status = 'aprobado'`
//   por defecto, así que acá ya no se toca `status` ni `reviewed_at`.
// - Sesión 18: `aforo`, `tipo_espacio`, `hora_inicio` y `hora_fin` se leen
//   del cuerpo y se validan acá (el aforo es obligatorio).
// - El resto de campos se copian tal cual los arma la pantalla.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionPublicador } from "@/lib/sesionPublicador";

type Fila = Record<string, unknown>;

// "HH:MM" en 24 h.
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  const sesion = await leerSesionPublicador();
  if (!sesion?.perfilId) {
    return NextResponse.json(
      { error: "Necesitás una cuenta para publicar." },
      { status: 401 },
    );
  }

  let cuerpo: {
    filas?: Fila[];
    aforo?: unknown;
    tipo_espacio?: unknown;
    hora_inicio?: unknown;
    hora_fin?: unknown;
  };
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

  // --- campos nuevos de la Sesión 18 ---
  const aforo = Number(cuerpo.aforo);
  if (!Number.isInteger(aforo) || aforo <= 0) {
    return NextResponse.json(
      { error: "Falta el aforo (número de personas)." },
      { status: 400 },
    );
  }
  const tipoEspacio =
    cuerpo.tipo_espacio === "abierto" || cuerpo.tipo_espacio === "cerrado"
      ? cuerpo.tipo_espacio
      : null;
  if (!tipoEspacio) {
    return NextResponse.json(
      { error: "Elegí si el espacio es abierto o cerrado." },
      { status: 400 },
    );
  }
  const horaInicio =
    typeof cuerpo.hora_inicio === "string" && RE_HORA.test(cuerpo.hora_inicio)
      ? cuerpo.hora_inicio
      : null;
  const horaFin =
    typeof cuerpo.hora_fin === "string" && RE_HORA.test(cuerpo.hora_fin)
      ? cuerpo.hora_fin
      : null;
  if (!horaInicio || !horaFin) {
    return NextResponse.json(
      { error: "Falta la hora de inicio o de fin." },
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
    aforo,
    tipo_espacio: tipoEspacio,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
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
