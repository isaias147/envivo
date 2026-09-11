// POST /api/eventos/denunciar  { eventId, motivo }
//
// Sesión 18 — moderación. El usuario final (Supabase Auth) reporta un evento.
// NO confía en el frontend:
//   - Exige el access_token del usuario en Authorization: Bearer.
//   - `getUser()` lo valida contra el servidor de auth.
//   - La denuncia se inserta COMO el usuario, así que la RLS de `reportes`
//     (`user_id = auth.uid()`) sigue aplicando. El `user_id` sale del token,
//     nunca del body.
//   - `reportes` tiene UNIQUE (event_id, user_id): reintentar no da error
//     (upsert que ignora el duplicado).
//
// Tras insertar, se cuentan las denuncias del evento (con service_role: la
// RLS de `reportes` solo deja ver las propias). Si llegan al umbral
// `max(6, aforo * 5%)`, se marca `events.oculto_por_denuncias = true`.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabaseServidor";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MOTIVOS = [
  "no_existe",
  "info_falsa",
  "lugar_equivocado",
  "inapropiado",
  "otro",
] as const;
type Motivo = (typeof MOTIVOS)[number];

const DENUNCIAS_MINIMAS = 6;
const FRACCION_AFORO = 0.05;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return NextResponse.json({ error: "Config incompleta." }, { status: 500 });
  }

  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  // Cliente que actúa COMO el usuario: la RLS lo trata como `authenticated`
  // con `auth.uid()` = su id.
  const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: errUser,
  } = await comoUsuario.auth.getUser();
  if (errUser || !user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  let cuerpo: { eventId?: string; motivo?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const eventId = String(cuerpo.eventId ?? "");
  if (!eventId) {
    return NextResponse.json({ error: "Falta el evento." }, { status: 400 });
  }
  const motivo = MOTIVOS.includes(cuerpo.motivo as Motivo)
    ? (cuerpo.motivo as Motivo)
    : null;
  if (!motivo) {
    return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  }

  // Insert idempotente: si esta persona ya denunció este evento, no pasa nada.
  const { error: errIns } = await comoUsuario
    .from("reportes")
    .upsert(
      { event_id: eventId, user_id: user.id, motivo },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    );
  if (errIns) {
    return NextResponse.json(
      { error: "No se pudo enviar la denuncia. Intenta de nuevo." },
      { status: 500 },
    );
  }

  // ¿Pasó el umbral? Se cuenta con service_role porque la RLS de `reportes`
  // solo deja ver las denuncias propias.
  const { count } = await supabaseServidor
    .from("reportes")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const { data: evento } = await supabaseServidor
    .from("events")
    .select("aforo, oculto_por_denuncias")
    .eq("id", eventId)
    .maybeSingle();

  if (evento && !evento.oculto_por_denuncias) {
    const aforo = typeof evento.aforo === "number" ? evento.aforo : 0;
    const umbral = Math.max(DENUNCIAS_MINIMAS, aforo * FRACCION_AFORO);
    if ((count ?? 0) >= umbral) {
      await supabaseServidor
        .from("events")
        .update({ oculto_por_denuncias: true })
        .eq("id", eventId);
    }
  }

  return NextResponse.json({ ok: true });
}
