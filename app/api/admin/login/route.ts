// POST /api/admin/login  { telefono, pin }
//
// Valida contra la función `verificar_admin` de Supabase (que compara el
// PIN con bcrypt y respeta el bloqueo por intentos). Si coincide, deja la
// cookie de sesión firmada. Todo ocurre en el servidor: la service_role
// key y el secreto de la cookie nunca llegan al navegador.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { COOKIE_ADMIN, crearTokenSesion } from "@/lib/adminSesion";

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

/** "+57" + los últimos 10 dígitos. Acepta "300 123 4567", "3001234567", "+57…". */
function normalizarTelefono(entrada: string): string {
  const digitos = entrada.replace(/\D/g, "");
  const diez = digitos.slice(-10);
  return `+57${diez}`;
}

export async function POST(request: Request) {
  let cuerpo: { telefono?: string; pin?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const telefono = normalizarTelefono(String(cuerpo.telefono ?? ""));
  const pin = String(cuerpo.pin ?? "").trim();

  if (telefono.length !== 13 || !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { error: "Escribe un número de 10 dígitos y tu PIN." },
      { status: 400 },
    );
  }

  // 1. ¿Coincide teléfono + PIN y la cuenta no está bloqueada?
  const { data, error } = await supabaseServidor.rpc("verificar_admin", {
    p_phone: telefono,
    p_pin: pin,
  });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo verificar. Intenta de nuevo." },
      { status: 500 },
    );
  }

  const admin = Array.isArray(data) ? data[0] : null;

  if (!admin) {
    // Sin coincidencia: puede ser PIN errado o cuenta bloqueada. Miramos el
    // estado para dar un mensaje útil y subir el contador de fallos.
    const { data: fila } = await supabaseServidor
      .from("admins")
      .select("id, failed_attempts, locked_until")
      .eq("phone", telefono)
      .maybeSingle();

    if (fila?.locked_until && new Date(fila.locked_until) > new Date()) {
      return NextResponse.json(
        {
          error:
            "Cuenta bloqueada por varios intentos fallidos. Espera unos minutos.",
        },
        { status: 423 },
      );
    }

    if (fila) {
      const fallos = (fila.failed_attempts ?? 0) + 1;
      const bloquear = fallos >= MAX_INTENTOS;
      await supabaseServidor
        .from("admins")
        .update({
          failed_attempts: bloquear ? 0 : fallos,
          locked_until: bloquear
            ? new Date(Date.now() + BLOQUEO_MIN * 60_000).toISOString()
            : null,
        })
        .eq("id", fila.id);

      if (bloquear) {
        return NextResponse.json(
          {
            error: `Demasiados intentos. Cuenta bloqueada ${BLOQUEO_MIN} minutos.`,
          },
          { status: 423 },
        );
      }
    }

    return NextResponse.json(
      { error: "Teléfono o PIN incorrectos." },
      { status: 401 },
    );
  }

  // 2. Entró: limpiamos el contador y guardamos la marca de tiempo.
  await supabaseServidor
    .from("admins")
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq("id", admin.id);

  // 3. Cookie de sesión firmada, HttpOnly.
  const debeCambiarPin = admin.must_change_pin === true;
  const { token, maxAge } = crearTokenSesion(
    admin.id,
    admin.name ?? null,
    debeCambiarPin,
  );
  const tarro = await cookies();
  tarro.set(COOKIE_ADMIN, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return NextResponse.json({
    ok: true,
    nombre: admin.name ?? null,
    debeCambiarPin,
  });
}
