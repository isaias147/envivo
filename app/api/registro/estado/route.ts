// GET /api/registro/estado
//
// Lo llama /registro/verificar: una vez al montar (para mostrar el código
// vigente) y luego cada 5 s hasta que `verificado` sea true. Todo se saca de
// la cookie `envivo_registro`; no recibe parámetros.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { estaVerificado } from "@/lib/registroPublicador";
import { leerRegistro } from "@/lib/sesionPublicador";

export async function GET() {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json({ sinRegistro: true, verificado: false });
  }

  const verificado = await estaVerificado(reg.whatsapp);

  // Código vigente (último no usado y no expirado) para mostrar los dígitos.
  const { data: fila } = await supabaseServidor
    .from("phone_codes")
    .select("codigo, expires_at")
    .eq("whatsapp", reg.whatsapp)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    verificado,
    nombre: reg.nombre,
    whatsapp: reg.whatsapp,
    codigo: fila?.codigo ?? null,
    expiraEn: fila?.expires_at ?? null,
  });
}
