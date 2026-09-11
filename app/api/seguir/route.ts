// POST /api/seguir  { perfilId, accion: "seguir" | "dejar" }
//
// Sesión 14, paso 2. El usuario final (Supabase Auth) sigue o deja de seguir
// a un perfil. NO confía en el frontend:
//   - Exige el access_token del usuario en el header Authorization.
//   - `getUser()` lo valida contra el servidor de auth.
//   - El cliente se crea CON ese token, así que la RLS de `seguimientos`
//     (`user_id = auth.uid()`) sigue aplicando como segunda barrera.
//
// Nada de esto toca la sesión del publicador (`envivo_publicador`): son dos
// sistemas distintos.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  const supa = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: errUser,
  } = await supa.auth.getUser();
  if (errUser || !user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  let cuerpo: { perfilId?: string; accion?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const perfilId = String(cuerpo.perfilId ?? "");
  if (!perfilId) {
    return NextResponse.json({ error: "Falta el perfil." }, { status: 400 });
  }
  const accion = cuerpo.accion === "dejar" ? "dejar" : "seguir";

  if (accion === "seguir") {
    const { error } = await supa
      .from("seguimientos")
      .upsert(
        { user_id: user.id, perfil_id: perfilId },
        { onConflict: "user_id,perfil_id", ignoreDuplicates: true },
      );
    if (error) {
      return NextResponse.json(
        { error: "No se pudo seguir. Intenta de nuevo." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, siguiendo: true });
  }

  const { error } = await supa
    .from("seguimientos")
    .delete()
    .eq("user_id", user.id)
    .eq("perfil_id", perfilId);
  if (error) {
    return NextResponse.json(
      { error: "No se pudo dejar de seguir. Intenta de nuevo." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, siguiendo: false });
}
