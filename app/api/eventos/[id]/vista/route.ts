// POST /api/eventos/[id]/vista
//
// Sesión 15 — panel de métricas. Registra que alguien abrió la ficha de un
// evento, para poder contarlas en /panel. Anónimo: no exige sesión de
// usuario final ni de publicador, y usa la anon key (ya hay política de RLS
// que deja insertar a anon/authenticated en `vistas_evento`).
//
// La cookie `envivo_visitante` (uuid al azar, 1 año, no HttpOnly porque el
// valor no es sensible) identifica el navegador sin pedir login. La tabla
// tiene UNIQUE (event_id, visitante_id, visto_el): una vista por evento y
// por día por visitante. Si ya existe, el insert falla por esa unicidad —
// se captura y se responde 200 igual, no es un error.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { hoyCali } from "@/lib/eventos";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const COOKIE_VISITANTE = "envivo_visitante";
const UN_ANO_SEGUNDOS = 365 * 24 * 3600;
const VIOLACION_UNIQUE = "23505";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/eventos/[id]/vista">,
) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return NextResponse.json({ error: "Config incompleta." }, { status: 500 });
  }

  const { id: eventId } = await ctx.params;
  if (!eventId) {
    return NextResponse.json({ error: "Falta el evento." }, { status: 400 });
  }

  const tarro = await cookies();
  let visitanteId = tarro.get(COOKIE_VISITANTE)?.value;
  if (!visitanteId) {
    visitanteId = randomUUID();
    tarro.set(COOKIE_VISITANTE, visitanteId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: UN_ANO_SEGUNDOS,
    });
  }

  const supa = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supa.from("vistas_evento").insert({
    event_id: eventId,
    visitante_id: visitanteId,
    visto_el: hoyCali(),
  });

  if (error && error.code !== VIOLACION_UNIQUE) {
    return NextResponse.json(
      { error: "No se pudo registrar la vista." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
