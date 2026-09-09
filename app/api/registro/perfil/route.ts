// POST /api/registro/perfil  { imagenUrl?, instagram?, tiktok?, indicativoPublico?, whatsappPublico? }
//
// Último paso del alta. Exige la cookie `envivo_registro` y que el número
// esté verificado. Crea (o actualiza) el `perfiles`, deja el `access_token`
// de /mis-eventos, cambia la cookie provisional por la sesión real
// `envivo_publicador` y responde con el destino (/panel).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { componerWhatsapp, sinArroba } from "@/lib/eventos";
import { crearOActualizarPerfil } from "@/lib/registroPublicador";
import { tokenParaWhatsapp } from "@/lib/tokenOrganizador";
import {
  COOKIE_PUBLICADOR,
  COOKIE_REGISTRO,
  crearTokenPublicador,
  leerRegistro,
} from "@/lib/sesionPublicador";

export async function POST(request: Request) {
  const reg = await leerRegistro();
  if (!reg) {
    return NextResponse.json(
      { error: "Empezá el registro de nuevo." },
      { status: 401 },
    );
  }
  if (!reg.verificado) {
    return NextResponse.json(
      { error: "Ese número todavía no está verificado." },
      { status: 403 },
    );
  }

  let cuerpo: {
    imagenUrl?: string;
    instagram?: string;
    tiktok?: string;
    indicativoPublico?: string;
    whatsappPublico?: string;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const indPub =
    String(cuerpo.indicativoPublico ?? "57").replace(/\D/g, "") || "57";
  const whatsappPublico = cuerpo.whatsappPublico
    ? componerWhatsapp(indPub, cuerpo.whatsappPublico)
    : reg.whatsapp;

  const igRaw = String(cuerpo.instagram ?? "").trim();
  const ttRaw = String(cuerpo.tiktok ?? "").trim();

  const res = await crearOActualizarPerfil({
    tipo: reg.tipo,
    nombre: reg.nombre,
    whatsapp: reg.whatsapp,
    whatsappPublico,
    instagram: igRaw ? sinArroba(igRaw) : null,
    tiktok: ttRaw ? sinArroba(ttRaw) : null,
    imagenUrl: String(cuerpo.imagenUrl ?? "").trim() || null,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  // Link de /mis-eventos (se reutiliza si el número ya publicó antes). Best
  // effort: si falla, el alta sigue en pie.
  try {
    await tokenParaWhatsapp(reg.whatsapp);
  } catch {
    // sin link; no es bloqueante
  }

  const { token, maxAge } = crearTokenPublicador(
    res.perfilId,
    res.nombre,
    reg.whatsapp,
  );
  const tarro = await cookies();
  tarro.set(COOKIE_PUBLICADOR, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  tarro.delete(COOKIE_REGISTRO);

  return NextResponse.json({ ok: true, destino: "/panel" });
}
