// GET /api/registro/estado
//
// Lo llaman /registro/verificar (para pintar los dos canales) y
// /registro/perfil (para no dejar entrar sin verificar los dos). Todo sale
// de la cookie `envivo_registro`. Los flags `smsOk` / `correoOk` los pone
// /api/registro/verificar.

import { NextResponse } from "next/server";
import { leerRegistro } from "@/lib/sesionPublicador";

export async function GET() {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json({ sinRegistro: true, smsOk: false, correoOk: false });
  }

  return NextResponse.json({
    smsOk: !!reg.smsOk,
    correoOk: !!reg.correoOk,
    nombre: reg.nombre,
    celular: reg.celular,
    correo: reg.correo,
  });
}
