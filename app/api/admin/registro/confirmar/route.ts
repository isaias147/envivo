// POST /api/admin/registro/confirmar  { whatsapp, codigo }
//
// El equipo confirma a mano un código que llegó por WhatsApp. Marca la fila
// `phone_codes.used_at`; a partir de ahí el polling de /registro/verificar
// deja pasar a la persona. Exige sesión de admin.
//
// Cuando se active el webhook de WhatsApp (camino A), llamará a esta misma
// `confirmarCodigo` — este endpoint queda solo para el modo manual.

import { NextResponse } from "next/server";
import { leerSesionAdmin } from "@/lib/adminSesion";
import { confirmarCodigo } from "@/lib/registroPublicador";

export async function POST(request: Request) {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let cuerpo: { whatsapp?: string; codigo?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const res = await confirmarCodigo(
    String(cuerpo.whatsapp ?? ""),
    String(cuerpo.codigo ?? ""),
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
