// GET /api/publicador/eventos
//
// Los eventos del publicador autenticado por cuenta de Google, mismo patrón
// que /api/publicador/sesion: exige `Authorization: Bearer <access_token>`,
// resuelve `user.id` con `auth.getUser()` sobre ese token (nunca del body) y
// busca `perfiles` por `user_id`. Sin perfil válido → 401.
//
// El filtro de eventos replica el de /mis-eventos (Server Component, cookie
// `envivo_publicador`): por `perfil_id`, o por el celular de la cuenta
// (`celular_cuenta`, normalizado) para lo publicado antes de registrarse y
// aún sin backfill.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { normalizarWhatsapp } from "@/lib/eventos";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const COLS_EVENTO =
  "id, title, cover_url, venue_name, starts_at, status, series_id, rejection_reason, whatsapp";

export async function GET(request: Request) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return NextResponse.json({ error: "Config incompleta." }, { status: 500 });
  }

  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await comoUsuario.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  const { data: perfil } = await supabaseServidor
    .from("perfiles")
    .select("id, celular_cuenta")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfil) {
    return NextResponse.json({ error: "Sin perfil de publicador." }, { status: 401 });
  }

  const wa = normalizarWhatsapp(perfil.celular_cuenta);
  const filtro = wa
    ? `perfil_id.eq.${perfil.id},whatsapp.eq.${wa}`
    : `perfil_id.eq.${perfil.id}`;

  const { data } = await supabaseServidor
    .from("events")
    .select(COLS_EVENTO)
    .or(filtro)
    .order("starts_at", { ascending: true });

  return NextResponse.json({ eventos: data ?? [] });
}
