// POST /api/publicador/perfil/editar
//
// Sesión 13, paso 7. El dueño edita su perfil desde /perfil:
//  - `nombre`: libre, sin candado.
//  - `instagram` y `whatsapp_publico`: bloqueados 30 días desde el último
//    cambio (`perfiles.ultimo_cambio_contacto`). Al cambiarlos, ese sello
//    se pone en ahora.
//
// El candado se revalida SIEMPRE aquí con el valor de la base, no se confía
// en el frontend (igual que la edición de eventos del paso 6). Escritura por
// service_role: `perfiles` no tiene policy de dueño todavía (Sesión 14).

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import {
  componerWhatsapp,
  normalizarWhatsapp,
  sinArroba,
} from "@/lib/eventos";
import { candadoContacto } from "@/lib/registroPublicador";
import { leerSesionPublicador } from "@/lib/sesionPublicador";

export async function POST(request: Request) {
  const sesion = await leerSesionPublicador();
  if (!sesion?.perfilId) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let cuerpo: {
    nombre?: string;
    instagram?: string;
    indicativoPublico?: string;
    whatsappPublico?: string;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const nombre = String(cuerpo.nombre ?? "").trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return NextResponse.json(
      { error: "El nombre va de 2 a 80 letras." },
      { status: 400 },
    );
  }

  const { data: perfil } = await supabaseServidor
    .from("perfiles")
    .select("instagram, whatsapp_publico, ultimo_cambio_contacto")
    .eq("id", sesion.perfilId)
    .maybeSingle();

  if (!perfil) {
    return NextResponse.json({ error: "No se encontró tu perfil." }, {
      status: 404,
    });
  }

  const { bloqueado, desbloqueaEn } = candadoContacto(
    perfil.ultimo_cambio_contacto,
  );

  // Valores nuevos de los campos con candado (normalizados como se guardan).
  const igNuevo = cuerpo.instagram?.trim()
    ? sinArroba(cuerpo.instagram.trim())
    : null;
  const indPub =
    String(cuerpo.indicativoPublico ?? "57").replace(/\D/g, "") || "57";
  const waNuevo = cuerpo.whatsappPublico?.trim()
    ? componerWhatsapp(indPub, cuerpo.whatsappPublico)
    : null;

  const igActual = perfil.instagram ?? null;
  const waActual = normalizarWhatsapp(perfil.whatsapp_publico) || null;
  const redesCambian = (igNuevo ?? "") !== (igActual ?? "") ||
    (waNuevo ?? "") !== (waActual ?? "");

  if (bloqueado && redesCambian) {
    return NextResponse.json(
      {
        error:
          "Instagram y WhatsApp público están bloqueados por ahora. El nombre sí se puede cambiar.",
        desbloqueaEn,
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { nombre };
  if (!bloqueado) {
    patch.instagram = igNuevo;
    patch.whatsapp_publico = waNuevo;
    if (redesCambian) patch.ultimo_cambio_contacto = new Date().toISOString();
  }

  const { error } = await supabaseServidor
    .from("perfiles")
    .update(patch)
    .eq("id", sesion.perfilId);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar. Intentá de nuevo." },
      { status: 500 },
    );
  }

  // Estado del candado después de guardar, para que /perfil se repinte bien.
  const despues = redesCambian && !bloqueado
    ? candadoContacto(new Date().toISOString())
    : { bloqueado, desbloqueaEn };

  return NextResponse.json({
    ok: true,
    redesCambiaron: redesCambian && !bloqueado,
    bloqueado: despues.bloqueado,
    desbloqueaEn: despues.desbloqueaEn,
  });
}
