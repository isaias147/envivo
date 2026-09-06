// POST /api/admin/fusionar  { id_a, id_b }
//
// Dos publicaciones para el mismo lugar, día y hora. Se conserva una —la
// del local, con su WhatsApp— y se le acredita el artista y el reel de la
// otra. La otra queda 'rechazada' con nota de fusión. Exige la cookie.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionAdmin } from "@/lib/adminSesion";

type Evento = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string | null;
  publisher_type: string | null;
  publisher_name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  post_url: string | null;
  artist_name: string | null;
  artist_instagram: string | null;
};

const primero = <T,>(...xs: (T | null | undefined)[]): T | null =>
  xs.find((x) => x != null && x !== "") ?? null;

export async function POST(request: Request) {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }

  let id_a: unknown;
  let id_b: unknown;
  try {
    ({ id_a, id_b } = await request.json());
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (typeof id_a !== "string" || typeof id_b !== "string" || id_a === id_b) {
    return NextResponse.json({ error: "Faltan los dos eventos." }, { status: 400 });
  }

  const { data, error } = await supabaseServidor
    .from("events")
    .select(
      "id, title, description, cover_url, status, publisher_type, publisher_name, whatsapp, instagram, tiktok, post_url, artist_name, artist_instagram",
    )
    .in("id", [id_a, id_b]);

  if (error || !data || data.length !== 2) {
    return NextResponse.json(
      { error: "No se encontraron los dos eventos." },
      { status: 404 },
    );
  }

  const [e1, e2] = data as Evento[];

  // El que se queda es el del local: primero por publisher_type, luego por
  // tener WhatsApp. El otro aporta el artista y el reel.
  const conserva =
    e1.publisher_type === "local" && e2.publisher_type !== "local"
      ? e1
      : e2.publisher_type === "local" && e1.publisher_type !== "local"
        ? e2
        : e1.whatsapp && !e2.whatsapp
          ? e1
          : e2.whatsapp && !e1.whatsapp
            ? e2
            : e1;
  const aporta = conserva.id === e1.id ? e2 : e1;

  const nombreArtista = primero(
    conserva.artist_name,
    aporta.publisher_type === "artista" ? aporta.publisher_name : null,
    aporta.artist_name,
  );

  const parcheConserva = {
    description: primero(conserva.description, aporta.description),
    cover_url: primero(conserva.cover_url, aporta.cover_url),
    post_url: primero(conserva.post_url, aporta.post_url),
    artist_name: nombreArtista,
    artist_instagram: primero(
      conserva.artist_instagram,
      aporta.publisher_type === "artista" ? aporta.instagram : null,
      aporta.artist_instagram,
    ),
    status: "aprobado",
    rejection_reason: null,
    reviewed_at: new Date().toISOString(),
  };

  const { error: errConserva } = await supabaseServidor
    .from("events")
    .update(parcheConserva)
    .eq("id", conserva.id);

  if (errConserva) {
    return NextResponse.json(
      { error: "No se pudo fusionar." },
      { status: 500 },
    );
  }

  const { error: errAporta } = await supabaseServidor
    .from("events")
    .update({
      status: "rechazado",
      rejection_reason: `Fusionado con el evento ${conserva.id}`,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", aporta.id);

  if (errAporta) {
    return NextResponse.json(
      { error: "Se aprobó uno pero no se pudo cerrar el otro. Revísalo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, conservado: conserva.id });
}
