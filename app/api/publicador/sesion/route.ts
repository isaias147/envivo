// GET /api/publicador/sesion
//
// ¿Quién está publicando? Lee la cookie firmada `envivo_publicador` (la que
// deja el alta de la Sesión 12) y devuelve el `perfil_id` + nombre para que
// /publicar/nuevo herede los datos del perfil en vez de pedirlos en el
// formulario. Sin sesión → `{ activa: false }` y el formulario cae al flujo
// viejo (sin perfil, campos de nombre y redes visibles).

import { NextResponse } from "next/server";
import { leerSesionPublicador } from "@/lib/sesionPublicador";

export async function GET() {
  const sesion = await leerSesionPublicador();
  if (!sesion) {
    return NextResponse.json({ activa: false });
  }
  return NextResponse.json({
    activa: true,
    perfilId: sesion.perfilId,
    nombre: sesion.nombre,
    whatsapp: sesion.whatsapp,
  });
}
