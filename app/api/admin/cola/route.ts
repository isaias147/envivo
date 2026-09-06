// GET /api/admin/cola
//
// Devuelve todo lo que pinta el panel:
//   - pendientes: eventos por revisar, con las series agrupadas por series_id
//   - duplicados: pares de la vista `posibles_duplicados`, con los datos de
//     ambos eventos para poder compararlos
//   - aprobadosHoy: cuántos aprobaste desde la medianoche (hora de Cali)
//
// Exige la cookie de sesión: sin ella responde 401.

import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionAdmin } from "@/lib/adminSesion";

// Colombia siempre es UTC−5 (sin horario de verano).
const OFFSET_CALI = "-05:00";

/** Medianoche de hoy en Cali, como ISO. */
function inicioHoyCali(): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${ymd}T00:00:00${OFFSET_CALI}`;
}

// Columnas que necesita cada tarjeta.
const COLS =
  "id, title, description, type, cover_url, venue_name, venue_address, latitude, longitude, starts_at, is_free, price, price_label, is_recurring, recurrence_rule, series_id, publisher_type, publisher_name, whatsapp, instagram, tiktok, post_url, artist_name, artist_instagram, status, created_at";

type Evento = Record<string, unknown> & {
  id: string;
  series_id: string | null;
  starts_at: string;
  whatsapp: string | null;
};

export async function GET() {
  const sesion = await leerSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  }
  if (sesion.cambiarPin) {
    return NextResponse.json(
      { error: "Cambia tu PIN primero.", debeCambiarPin: true },
      { status: 403 },
    );
  }

  // 1. Pendientes, del más próximo al más lejano.
  const { data: pendientesRaw, error: errPend } = await supabaseServidor
    .from("events")
    .select(COLS)
    .eq("status", "pendiente")
    .order("starts_at", { ascending: true });

  if (errPend) {
    return NextResponse.json(
      { error: "No se pudo leer la cola." },
      { status: 500 },
    );
  }
  const pendientes = (pendientesRaw ?? []) as Evento[];

  // 2. Pares de posibles duplicados.
  const { data: paresRaw, error: errDup } = await supabaseServidor
    .from("posibles_duplicados")
    .select("id_a, id_b, venue_name, starts_at");

  if (errDup) {
    return NextResponse.json(
      { error: "No se pudo leer los duplicados." },
      { status: 500 },
    );
  }
  const pares = (paresRaw ?? []) as {
    id_a: string;
    id_b: string;
    venue_name: string | null;
    starts_at: string;
  }[];

  // Datos completos de cada evento que aparece en un par (pendiente o no).
  const idsDup = [...new Set(pares.flatMap((p) => [p.id_a, p.id_b]))];
  let porId = new Map<string, Evento>();
  if (idsDup.length > 0) {
    const { data: evsDup } = await supabaseServidor
      .from("events")
      .select(COLS)
      .in("id", idsDup);
    porId = new Map(((evsDup ?? []) as Evento[]).map((e) => [e.id, e]));
  }

  const duplicados = pares
    .map((p) => {
      const a = porId.get(p.id_a);
      const b = porId.get(p.id_b);
      if (!a || !b) return null;
      return { venue_name: p.venue_name, starts_at: p.starts_at, a, b };
    })
    .filter(Boolean);

  const idsEnDuplicado = new Set(idsDup);

  // 3. Agrupar pendientes: una tarjeta por serie, una por evento suelto.
  type Tarjeta = Evento & {
    key: string;
    esSerie: boolean;
    ids: string[];
    fechas: string[];
    total: number;
    posibleDuplicado: boolean;
  };

  const grupos = new Map<string, Evento[]>();
  const sueltos: Evento[] = [];
  for (const ev of pendientes) {
    if (ev.series_id) {
      const g = grupos.get(ev.series_id) ?? [];
      g.push(ev);
      grupos.set(ev.series_id, g);
    } else {
      sueltos.push(ev);
    }
  }

  const tarjetas: Tarjeta[] = [];

  for (const ev of sueltos) {
    tarjetas.push({
      ...ev,
      key: ev.id,
      esSerie: false,
      ids: [ev.id],
      fechas: [ev.starts_at],
      total: 1,
      posibleDuplicado: idsEnDuplicado.has(ev.id),
    });
  }

  for (const [seriesId, filas] of grupos) {
    filas.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    const rep = filas[0];
    tarjetas.push({
      ...rep,
      key: seriesId,
      esSerie: true,
      ids: filas.map((f) => f.id),
      fechas: filas.map((f) => f.starts_at),
      total: filas.length,
      posibleDuplicado: filas.some((f) => idsEnDuplicado.has(f.id)),
    });
  }

  // Orden final por la primera fecha de cada tarjeta.
  tarjetas.sort((x, y) => x.starts_at.localeCompare(y.starts_at));

  // 4. Aprobados hoy.
  const { count: aprobadosHoy } = await supabaseServidor
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("status", "aprobado")
    .gte("reviewed_at", inicioHoyCali());

  return NextResponse.json({
    pendientes: tarjetas,
    duplicados,
    aprobadosHoy: aprobadosHoy ?? 0,
  });
}
