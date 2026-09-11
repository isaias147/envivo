// POST /api/yo/eliminar
//
// Borra la cuenta del USUARIO FINAL (Supabase Auth). `auth.admin.deleteUser`
// solo existe con service_role, así que va por acá.
//
// - Exige el access_token del usuario en Authorization: Bearer y lo valida
//   con getUser(): solo se puede borrar UNO MISMO (el id sale del token,
//   nunca del body).
// - `seguimientos.user_id` tiene FK ON DELETE CASCADE, así que el
//   deleteUser ya arrastra sus filas; igual las borramos explícito antes.
// - Nada de esto toca la sesión del publicador (`envivo_publicador`).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabaseServidor";

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

  // Cascada de la FK; explícito por si acaso.
  await supabaseServidor.from("seguimientos").delete().eq("user_id", user.id);

  const { error: errDel } = await supabaseServidor.auth.admin.deleteUser(
    user.id,
  );
  if (errDel) {
    return NextResponse.json(
      { error: "No se pudo borrar la cuenta. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
