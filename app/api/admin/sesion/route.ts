// GET /api/admin/sesion — ¿hay cookie de sesión válida? La usan /admin
// (para saltar el login si ya entraste) y /admin/cola (para exigirlo).

import { NextResponse } from "next/server";
import { leerSesionAdmin } from "@/lib/adminSesion";

export async function GET() {
  const sesion = await leerSesionAdmin();
  return NextResponse.json(
    sesion
      ? {
          activa: true,
          nombre: sesion.nombre,
          debeCambiarPin: sesion.cambiarPin,
        }
      : { activa: false },
  );
}
