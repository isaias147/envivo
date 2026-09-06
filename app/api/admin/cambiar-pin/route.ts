// POST /api/admin/cambiar-pin  { pinActual, pinNuevo }
//
// Cambia el PIN del admin de la sesión actual. El teléfono se saca del id
// que va firmado en la cookie (no se pide de nuevo); el PIN actual sí se
// vuelve a pedir como comprobación. La función `cambiar_pin_admin` exige
// que el PIN nuevo tenga exactamente 4 dígitos y apaga `must_change_pin`.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabaseServidor";
import {
  COOKIE_ADMIN,
  crearTokenSesion,
  leerSesionAdmin,
} from "@/lib/adminSesion";

export async function POST(request: Request) {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let cuerpo: { pinActual?: string; pinNuevo?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const pinActual = String(cuerpo.pinActual ?? "").trim();
  const pinNuevo = String(cuerpo.pinNuevo ?? "").trim();

  if (!/^\d{4}$/.test(pinNuevo)) {
    return NextResponse.json(
      { error: "El PIN nuevo debe ser de 4 dígitos." },
      { status: 400 },
    );
  }
  if (pinNuevo === pinActual) {
    return NextResponse.json(
      { error: "El PIN nuevo tiene que ser distinto del actual." },
      { status: 400 },
    );
  }

  // Teléfono del admin de la sesión.
  const { data: fila, error: errFila } = await supabaseServidor
    .from("admins")
    .select("phone")
    .eq("id", sesion.id)
    .maybeSingle();

  if (errFila || !fila?.phone) {
    return NextResponse.json(
      { error: "No se pudo encontrar la cuenta." },
      { status: 404 },
    );
  }

  const { data: ok, error } = await supabaseServidor.rpc("cambiar_pin_admin", {
    p_phone: fila.phone,
    p_pin_actual: pinActual,
    p_pin_nuevo: pinNuevo,
  });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo cambiar el PIN. Intenta de nuevo." },
      { status: 500 },
    );
  }
  if (ok !== true) {
    return NextResponse.json(
      { error: "El PIN actual no es correcto." },
      { status: 400 },
    );
  }

  // Reemitimos la cookie sin la marca de "debe cambiar el PIN".
  const { token, maxAge } = crearTokenSesion(sesion.id, sesion.nombre, false);
  const tarro = await cookies();
  tarro.set(COOKIE_ADMIN, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return NextResponse.json({ ok: true });
}
