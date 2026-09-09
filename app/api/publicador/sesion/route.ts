// GET /api/publicador/sesion
//
// ¿Quién está publicando? Lee la cookie firmada `envivo_publicador` (la que
// deja el alta de la Sesión 12) y devuelve el `perfil_id` + nombre para que
// /publicar/nuevo herede los datos del perfil en vez de pedirlos en el
// formulario. Sin sesión → `{ activa: false }` y el formulario cae al flujo
// viejo (sin perfil, campos de nombre y redes visibles).

import { NextResponse } from "next/server";
import { leerSesionPublicador } from "@/lib/sesionPublicador";
import { supabaseServidor } from "@/lib/supabaseServidor";

export async function GET() {
  const sesion = await leerSesionPublicador();
  if (!sesion) {
    return NextResponse.json({ activa: false });
  }
  // El tipo no viaja en la cookie: se consulta. /publicar/nuevo lo usa para
  // saber si publica un local, un organizador o un artista, sin preguntarlo.
  const { data: perfil } = await supabaseServidor
    .from("perfiles")
    .select("tipo")
    .eq("id", sesion.perfilId)
    .maybeSingle();

  return NextResponse.json({
    activa: true,
    perfilId: sesion.perfilId,
    nombre: sesion.nombre,
    whatsapp: sesion.whatsapp,
    tipo: perfil?.tipo ?? "local",
  });
}
