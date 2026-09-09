// GET /api/registro/estado
//
// Lo llama /registro/verificar al montar (para saber si ya está verificado y
// mostrar el número) y /registro/perfil al montar (para no dejar entrar sin
// verificar). Todo sale de la cookie `envivo_registro`; no recibe
// parámetros. El flag `verificado` lo pone /api/registro/verificar.

import { NextResponse } from "next/server";
import { leerRegistro } from "@/lib/sesionPublicador";

export async function GET() {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json({ sinRegistro: true, verificado: false });
  }

  return NextResponse.json({
    verificado: !!reg.verificado,
    nombre: reg.nombre,
    whatsapp: reg.whatsapp,
  });
}
