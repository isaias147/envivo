// POST /api/registro/reenviar
//
// "¿No llegó? Reenviar SMS" en /registro/verificar. Toma el número de la
// cookie `envivo_registro` y le pide a Twilio Verify que mande otro SMS.
// Twilio aplica su propio tope de reenvíos.

import { NextResponse } from "next/server";
import { iniciarVerificacion } from "@/lib/registroPublicador";
import { leerRegistro } from "@/lib/sesionPublicador";

export async function POST() {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json(
      { error: "Empezá el registro de nuevo." },
      { status: 401 },
    );
  }

  const res = await iniciarVerificacion(reg.whatsapp);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
