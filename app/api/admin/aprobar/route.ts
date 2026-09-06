// POST /api/admin/aprobar  { ids: string[] }
//
// Marca uno o varios eventos como 'aprobado'. Para una serie se mandan
// todos los ids de sus fechas. Exige la cookie de sesión.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionAdmin } from "@/lib/adminSesion";
import { tokenParaWhatsapp } from "@/lib/tokenOrganizador";
import { normalizarWhatsapp } from "@/lib/eventos";

export async function POST(request: Request) {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let ids: unknown;
  try {
    ({ ids } = await request.json());
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "Faltan los eventos." }, { status: 400 });
  }

  const { data: aprobados, error } = await supabaseServidor
    .from("events")
    .update({
      status: "aprobado",
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
    })
    .in("id", ids as string[])
    .eq("status", "pendiente")
    .select("whatsapp");

  if (error) {
    return NextResponse.json(
      { error: "No se pudo aprobar. Intenta de nuevo." },
      { status: 500 },
    );
  }

  // Cada WhatsApp recién aprobado necesita su link de /mis-eventos (se crea
  // una vez y se reutiliza). Si algo falla aquí, el evento ya quedó aprobado:
  // no lo revertimos, solo omitimos ese link.
  const numeros = [
    ...new Set(
      (aprobados ?? [])
        .map((e) => normalizarWhatsapp(e.whatsapp))
        .filter((w) => w.length > 0),
    ),
  ];
  const misEventos: { whatsapp: string; token: string }[] = [];
  for (const wa of numeros) {
    try {
      const token = await tokenParaWhatsapp(wa);
      if (token) misEventos.push({ whatsapp: wa, token });
    } catch {
      // link no generado; la aprobación sigue en pie
    }
  }

  return NextResponse.json({ ok: true, misEventos });
}
