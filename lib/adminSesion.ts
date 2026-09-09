// ⚠️ SOLO SERVIDOR. Maneja la cookie de sesión del panel de administración.
//
// La cookie (`envivo_admin`) guarda un texto firmado con HMAC-SHA256. El
// navegador no puede leerla (HttpOnly) ni falsificarla (no conoce el
// secreto). El secreto es la propia service_role key, que nunca sale del
// servidor; si algún día quieres uno aparte, define ADMIN_SESSION_SECRET.

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_ADMIN = "envivo_admin";
const DURACION_HORAS = 8;

const secreto =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

if (!secreto) {
  throw new Error(
    "Falta SUPABASE_SERVICE_ROLE_KEY (o ADMIN_SESSION_SECRET) para firmar la sesión del panel",
  );
}

export type SesionAdmin = {
  id: string; // id del admin en la tabla `admins`
  nombre: string | null;
  cambiarPin: boolean; // true si aún no ha cambiado el PIN inicial
  exp: number; // caducidad, en segundos epoch
};

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function firmar(carga: string): string {
  return base64url(createHmac("sha256", secreto).update(carga).digest());
}

/** Construye el valor firmado de la cookie para un admin. */
export function crearTokenSesion(
  id: string,
  nombre: string | null,
  cambiarPin: boolean,
): {
  token: string;
  maxAge: number;
} {
  const exp = Math.floor(Date.now() / 1000) + DURACION_HORAS * 3600;
  const datos: SesionAdmin = { id, nombre, cambiarPin, exp };
  const carga = base64url(Buffer.from(JSON.stringify(datos), "utf8"));
  return { token: `${carga}.${firmar(carga)}`, maxAge: DURACION_HORAS * 3600 };
}

/** Verifica un valor de cookie. Devuelve la sesión o null si no es válida. */
export function verificarTokenSesion(token: string | undefined): SesionAdmin | null {
  if (!token) return null;
  const punto = token.lastIndexOf(".");
  if (punto < 1) return null;

  const carga = token.slice(0, punto);
  const firma = token.slice(punto + 1);

  const esperada = firmar(carga);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const datos = JSON.parse(
      Buffer.from(carga.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as SesionAdmin;
    if (!datos?.id || typeof datos.exp !== "number") return null;
    if (datos.exp * 1000 < Date.now()) return null;
    return { ...datos, cambiarPin: datos.cambiarPin === true };
  } catch {
    return null;
  }
}

/**
 * Lee la cookie de la petición actual y devuelve la sesión, o null.
 * Úsala al principio de cada API route del panel para exigir login.
 */
export async function leerSesionAdmin(): Promise<SesionAdmin | null> {
  const tarro = await cookies();
  return verificarTokenSesion(tarro.get(COOKIE_ADMIN)?.value);
}
