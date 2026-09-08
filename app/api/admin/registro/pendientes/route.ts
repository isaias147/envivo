// GET /api/admin/registro/pendientes
//
// Códigos de verificación esperando confirmación manual (camino B de la
// Sesión 12: alguien mandó el código por WhatsApp al número de EnVivo y el
// equipo lo confirma a mano desde /admin/registro). Exige sesión de admin.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionAdmin } from "@/lib/adminSesion";

export async function GET() {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  const ahora = new Date().toISOString();
  const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [pend, conf] = await Promise.all([
    supabaseServidor
      .from("phone_codes")
      .select("id, whatsapp, codigo, created_at, expires_at, intentos")
      .is("used_at", null)
      .gt("expires_at", ahora)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseServidor
      .from("phone_codes")
      .select("id, whatsapp, codigo, used_at")
      .not("used_at", "is", null)
      .gte("used_at", hace2h)
      .order("used_at", { ascending: false })
      .limit(20),
  ]);

  if (pend.error) {
    return NextResponse.json(
      { error: "No se pudo leer la lista." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    pendientes: pend.data ?? [],
    confirmadosRecientes: conf.data ?? [],
  });
}
