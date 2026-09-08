// POST /api/registro/logout
//
// Borra la cookie de sesión del publicador y vuelve a /registro. Lo llama el
// formulario "Cerrar sesión" de /panel (sin JavaScript).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_PUBLICADOR } from "@/lib/sesionPublicador";

export async function POST(request: Request) {
  const tarro = await cookies();
  tarro.delete(COOKIE_PUBLICADOR);
  return NextResponse.redirect(new URL("/registro", request.url), {
    status: 303,
  });
}
