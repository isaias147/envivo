// GET /api/registro/sesion
//
// ¿Ya hay sesión de publicador? Lo usa /registro para saltar directo a
// /panel si la persona ya está registrada (igual que /api/admin/sesion).

import { NextResponse } from "next/server";
import { leerSesionPublicador } from "@/lib/sesionPublicador";

export async function GET() {
  const sesion = await leerSesionPublicador();
  return NextResponse.json({
    activa: !!sesion,
    nombre: sesion?.nombre ?? null,
  });
}
