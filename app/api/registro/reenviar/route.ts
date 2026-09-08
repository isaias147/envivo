// POST /api/registro/reenviar
//
// "¿No llegó? Generar otro código" en /registro/verificar. Toma el número de
// la cookie `envivo_registro` y genera un código nuevo (mismo tope de 3 por
// hora que /iniciar).

import { NextResponse } from "next/server";
import { generarCodigo } from "@/lib/registroPublicador";
import { leerRegistro } from "@/lib/sesionPublicador";

export async function POST() {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json(
      { error: "Empezá el registro de nuevo." },
      { status: 401 },
    );
  }

  const res = await generarCodigo(reg.whatsapp);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({
    ok: true,
    codigo: res.codigo,
    expiraEn: res.expiraEn,
  });
}
