// GET /api/admin/eventos?whatsapp=...
//
// "Otros de este WhatsApp": todo lo que ha publicado ese número, en
// cualquier estado, para decidir con contexto. Exige la cookie de sesión.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionAdmin } from "@/lib/adminSesion";
import { normalizarWhatsapp } from "@/lib/eventos";

export async function GET(request: Request) {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  const whatsapp = normalizarWhatsapp(
    new URL(request.url).searchParams.get("whatsapp"),
  );
  if (!whatsapp) {
    return NextResponse.json({ error: "Falta el WhatsApp." }, { status: 400 });
  }

  const { data, error } = await supabaseServidor
    .from("events")
    .select(
      "id, title, starts_at, venue_name, status, is_free, price_label, series_id, publisher_name, publisher_type",
    )
    .eq("whatsapp", whatsapp)
    .order("starts_at", { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo consultar." },
      { status: 500 },
    );
  }

  return NextResponse.json({ eventos: data ?? [] });
}
