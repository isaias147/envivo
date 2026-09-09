// POST /api/registro/iniciar
//   { tipo, indicativo, whatsapp, nombre,
//     adminNombre, adminApellido, adminEdad, correo }
//
// Pantalla /registro (5a+5b fusionadas). Valida todo, le pide a Twilio
// Verify que mande los DOS códigos (SMS + correo) y deja la cookie
// provisional `envivo_registro` con todos los datos (sin los flags smsOk /
// correoOk todavía). El perfil se crea recién en /api/registro/perfil.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { componerWhatsapp } from "@/lib/eventos";
import {
  esCorreoValido,
  iniciarVerificacion,
} from "@/lib/registroPublicador";
import { esTipoPerfil } from "@/lib/tiposPerfil";
import { COOKIE_REGISTRO, crearTokenRegistro } from "@/lib/sesionPublicador";

export async function POST(request: Request) {
  let cuerpo: {
    tipo?: string;
    indicativo?: string;
    whatsapp?: string;
    nombre?: string;
    adminNombre?: string;
    adminApellido?: string;
    adminEdad?: unknown;
    correo?: string;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const tipo = String(cuerpo.tipo ?? "");
  const nombre = String(cuerpo.nombre ?? "").trim();
  const adminNombre = String(cuerpo.adminNombre ?? "").trim();
  const adminApellido = String(cuerpo.adminApellido ?? "").trim();
  const adminEdad = Number(cuerpo.adminEdad);
  const correo = String(cuerpo.correo ?? "").trim().toLowerCase();
  const indicativo = String(cuerpo.indicativo ?? "57").replace(/\D/g, "") || "57";
  const whatsapp = componerWhatsapp(indicativo, cuerpo.whatsapp);

  if (!esTipoPerfil(tipo)) {
    return NextResponse.json({ error: "Elegí un tipo." }, { status: 400 });
  }
  if (nombre.length < 2 || nombre.length > 80) {
    return NextResponse.json(
      { error: "Escribí el nombre del local o marca (2 a 80 letras)." },
      { status: 400 },
    );
  }
  if (adminNombre.length < 2 || adminNombre.length > 60) {
    return NextResponse.json(
      { error: "Escribí el nombre del administrador." },
      { status: 400 },
    );
  }
  if (adminApellido.length < 2 || adminApellido.length > 60) {
    return NextResponse.json(
      { error: "Escribí el apellido del administrador." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(adminEdad) || adminEdad < 14 || adminEdad > 120) {
    return NextResponse.json(
      { error: "Escribí una edad válida." },
      { status: 400 },
    );
  }
  if (whatsapp.length < 8) {
    return NextResponse.json(
      { error: "Escribí un WhatsApp válido." },
      { status: 400 },
    );
  }
  if (!esCorreoValido(correo)) {
    return NextResponse.json(
      { error: "Escribí un correo válido." },
      { status: 400 },
    );
  }

  // Manda los dos códigos. Si ninguno sale, no avanzamos. Si sale al menos
  // uno, seguimos: /registro/verificar tiene "reenviar" por canal.
  const [sms, email] = await Promise.all([
    iniciarVerificacion(whatsapp, "sms"),
    iniciarVerificacion(correo, "email"),
  ]);
  if (!sms.ok && !email.ok) {
    return NextResponse.json({ error: sms.error }, { status: sms.status });
  }

  const { token, maxAge } = crearTokenRegistro({
    tipo,
    nombre,
    whatsapp,
    correo,
    adminNombre,
    adminApellido,
    adminEdad,
  });
  const tarro = await cookies();
  tarro.set(COOKIE_REGISTRO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return NextResponse.json({
    ok: true,
    smsError: sms.ok ? null : sms.error,
    correoError: email.ok ? null : email.error,
  });
}
