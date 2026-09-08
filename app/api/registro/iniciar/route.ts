// POST /api/registro/iniciar  { tipo, indicativo, whatsapp, nombre }
//
// Paso 2 de /registro. Genera un código de 4 dígitos, lo guarda en
// `phone_codes` (expira en 10 min, tope 3 por hora por número) y deja la
// cookie provisional `envivo_registro` con tipo + nombre + WhatsApp. No crea
// perfil todavía: eso ocurre en /api/registro/perfil.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { componerWhatsapp } from "@/lib/eventos";
import { esTipoPerfil, generarCodigo } from "@/lib/registroPublicador";
import { COOKIE_REGISTRO, crearTokenRegistro } from "@/lib/sesionPublicador";

export async function POST(request: Request) {
  let cuerpo: {
    tipo?: string;
    indicativo?: string;
    whatsapp?: string;
    nombre?: string;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const tipo = String(cuerpo.tipo ?? "");
  const nombre = String(cuerpo.nombre ?? "").trim();
  const indicativo = String(cuerpo.indicativo ?? "57").replace(/\D/g, "") || "57";
  const whatsapp = componerWhatsapp(indicativo, cuerpo.whatsapp);

  if (!esTipoPerfil(tipo)) {
    return NextResponse.json({ error: "Elegí un tipo." }, { status: 400 });
  }
  if (nombre.length < 2 || nombre.length > 80) {
    return NextResponse.json(
      { error: "Escribí un nombre (entre 2 y 80 letras)." },
      { status: 400 },
    );
  }
  if (whatsapp.length < 8) {
    return NextResponse.json(
      { error: "Escribí un WhatsApp válido." },
      { status: 400 },
    );
  }

  const res = await generarCodigo(whatsapp);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { token, maxAge } = crearTokenRegistro({ tipo, nombre, whatsapp });
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
    codigo: res.codigo,
    expiraEn: res.expiraEn,
  });
}
