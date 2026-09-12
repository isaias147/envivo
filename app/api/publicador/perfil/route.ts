// GET /api/publicador/perfil
//
// El perfil del publicador autenticado por cuenta de Google, mismo patrón
// que /api/publicador/sesion: exige `Authorization: Bearer <access_token>`,
// resuelve `user.id` con `auth.getUser()` sobre ese token (nunca del body) y
// busca `perfiles` por `user_id`. Sin perfil válido → 401.
//
// Los campos son los mismos que ya lee /perfil/page.tsx (cookie
// `envivo_publicador`), más el conteo de seguidores.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabaseServidor";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    .select(
      "id, slug, nombre, tipo, instagram, whatsapp_publico, ultimo_cambio_contacto",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfil) {
    return NextResponse.json({ error: "Sin perfil de publicador." }, { status: 401 });
  }

  const { count } = await supabaseServidor
    .from("seguimientos")
    .select("*", { count: "exact", head: true })
    .eq("perfil_id", perfil.id);

  return NextResponse.json({
    perfilId: perfil.id,
    slug: perfil.slug,
    nombre: perfil.nombre,
    tipo: perfil.tipo,
    instagram: perfil.instagram,
    whatsappPublico: perfil.whatsapp_publico,
    ultimoCambioContacto: perfil.ultimo_cambio_contacto,
    seguidores: count ?? 0,
  });
}
