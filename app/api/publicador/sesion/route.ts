// GET /api/publicador/sesion
//
// ¿Quién está publicando? Dos formas de resolverlo:
//
// 1. Con `Authorization: Bearer <access_token de Google>` — busca el
//    `perfiles` por `user_id` (auth.getUser() sobre ese token, nunca del
//    body). La usan /yo y / (mapa público) para saber si la cuenta de
//    Google logueada tiene perfil de publicador.
// 2. Sin esa cabecera — el camino de siempre: la cookie firmada
//    `envivo_publicador` (la que deja el alta). La sigue usando
//    /publicar/nuevo tal cual; no se retira.
//
// Sin sesión (de ningún tipo) → `{ activa: false }`.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { leerSesionPublicador } from "@/lib/sesionPublicador";
import { supabaseServidor } from "@/lib/supabaseServidor";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: Request) {
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";

  if (token && SUPABASE_URL && ANON_KEY) {
    const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await comoUsuario.auth.getUser();
    if (!user) return NextResponse.json({ activa: false });

    const { data: perfil } = await supabaseServidor
      .from("perfiles")
      .select("id, nombre, whatsapp_cuenta, tipo")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!perfil) return NextResponse.json({ activa: false });

    return NextResponse.json({
      activa: true,
      perfilId: perfil.id,
      nombre: perfil.nombre,
      whatsapp: perfil.whatsapp_cuenta,
      tipo: perfil.tipo,
    });
  }

  const sesion = await leerSesionPublicador();
  if (!sesion) {
    return NextResponse.json({ activa: false });
  }
  // El tipo no viaja en la cookie: se consulta. /publicar/nuevo lo usa para
  // saber si publica un local, un organizador o un artista, sin preguntarlo.
  const { data: perfil } = await supabaseServidor
    .from("perfiles")
    .select("tipo")
    .eq("id", sesion.perfilId)
    .maybeSingle();

  return NextResponse.json({
    activa: true,
    perfilId: sesion.perfilId,
    nombre: sesion.nombre,
    whatsapp: sesion.whatsapp,
    tipo: perfil?.tipo ?? "local",
  });
}
