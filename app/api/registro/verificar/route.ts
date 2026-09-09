// POST /api/registro/verificar  { codigo }
//
// Lo llama /registro/verificar cuando el usuario escribe el código que le
// llegó por SMS. Toma el número de la cookie `envivo_registro`, se lo pasa a
// Twilio Verify y, si Twilio lo aprueba, vuelve a firmar la cookie con el
// flag `verificado: true`. A partir de ahí /registro/perfil deja seguir.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { comprobarCodigo } from "@/lib/registroPublicador";
import {
  COOKIE_REGISTRO,
  crearTokenRegistro,
  leerRegistro,
} from "@/lib/sesionPublicador";

export async function POST(request: Request) {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json(
      { error: "Empezá el registro de nuevo." },
      { status: 401 },
    );
  }

  let cuerpo: { codigo?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const res = await comprobarCodigo(reg.whatsapp, String(cuerpo.codigo ?? ""));
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  // Reemitimos la cookie provisional con el flag puesto (y 20 min frescos
  // para terminar el perfil). El resto de los datos se conservan.
  const { token, maxAge } = crearTokenRegistro({
    tipo: reg.tipo,
    nombre: reg.nombre,
    whatsapp: reg.whatsapp,
    verificado: true,
  });
  const tarro = await cookies();
  tarro.set(COOKIE_REGISTRO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return NextResponse.json({ ok: true });
}
