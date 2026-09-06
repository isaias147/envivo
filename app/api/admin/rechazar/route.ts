// POST /api/admin/rechazar  { ids: string[], motivo?: string }
//
// Marca uno o varios eventos como 'rechazado'. Exige la cookie de sesión.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionAdmin } from "@/lib/adminSesion";

export async function POST(request: Request) {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let ids: unknown;
  let motivo: unknown;
  try {
    ({ ids, motivo } = await request.json());
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "Faltan los eventos." }, { status: 400 });
  }

  const razon =
    typeof motivo === "string" && motivo.trim() ? motivo.trim().slice(0, 200) : null;

  const { error } = await supabaseServidor
    .from("events")
    .update({
      status: "rechazado",
      rejection_reason: razon,
      reviewed_at: new Date().toISOString(),
    })
    .in("id", ids as string[])
    .eq("status", "pendiente");

  if (error) {
    return NextResponse.json(
      { error: "No se pudo rechazar. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
