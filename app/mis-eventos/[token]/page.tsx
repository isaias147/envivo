// Pantalla 6 · /mis-eventos/[token] — lo que ha publicado un WhatsApp.
// Sigue el bloque "4 · Mis eventos (link personal)" de
// envivo-pantallas-organizador.html.
//
// - Server Component: lee `events` con la service_role key (los pendientes y
//   rechazados no están en `eventos_publicos` ni son visibles para el anon).
// - Solo lectura: aquí no se aprueba, edita ni borra nada.
// - Cuatro secciones: En el mapa · En revisión · No publicado · Ya pasaron.
//   Las series se muestran como una sola tarjeta, igual que en la cola.
// - El token es un enlace privado: la página va con `noindex`.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { formatearWhatsapp, horaCali, normalizarWhatsapp } from "@/lib/eventos";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tus eventos · EnVivo",
  robots: { index: false, follow: false },
};

// ---------- tipos y datos ----------

type Fila = {
  id: string;
  title: string;
  cover_url: string | null;
  venue_name: string | null;
  starts_at: string;
  status: string | null;
  series_id: string | null;
  rejection_reason: string | null;
};

/** Una tarjeta: un evento suelto o una serie agrupada por `series_id`. */
type Grupo = {
  key: string;
  title: string;
  cover_url: string | null;
  venue_name: string | null;
  starts_at: string; // fecha representativa (la próxima, o la última si ya pasó)
  total: number;
  rejection_reason: string | null;
};

/**
 * Agrupa las filas por serie. `modo` decide qué fecha representa al grupo y
 * en qué orden salen: "proximo" = la más cercana primero; "reciente" = la
 * última primero.
 */
function agrupar(filas: Fila[], modo: "proximo" | "reciente"): Grupo[] {
  const mapa = new Map<string, Fila[]>();
  for (const f of filas) {
    const clave = f.series_id ?? f.id;
    const g = mapa.get(clave) ?? [];
    g.push(f);
    mapa.set(clave, g);
  }

  const grupos: Grupo[] = [];
  for (const [key, g] of mapa) {
    g.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const rep = modo === "proximo" ? g[0] : g[g.length - 1];
    grupos.push({
      key,
      title: rep.title,
      cover_url: rep.cover_url,
      venue_name: rep.venue_name,
      starts_at: rep.starts_at,
      total: g.length,
      rejection_reason: rep.rejection_reason,
    });
  }

  grupos.sort((a, b) =>
    modo === "proximo"
      ? a.starts_at.localeCompare(b.starts_at)
      : b.starts_at.localeCompare(a.starts_at),
  );
  return grupos;
}

// ---------- formato de fechas en hora de Cali ----------

/** "Jue 17 sep" */
function fechaCorta(iso: string): string {
  const t = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
  return t.replace(".", "").replace(/(^\w)/, (c) => c.toUpperCase());
}

function horaTexto(iso: string): string {
  const { hhmm, periodo } = horaCali(iso);
  return `${hhmm} ${periodo}`;
}

function subtitulo(g: Grupo): string {
  return [fechaCorta(g.starts_at), horaTexto(g.starts_at), g.venue_name]
    .filter(Boolean)
    .join(" · ");
}

/** Reparte las filas en las cuatro secciones de la pantalla. */
function repartir(filas: Fila[]): {
  enMapa: Grupo[];
  enRevision: Grupo[];
  noPublicado: Grupo[];
  yaPasaron: Grupo[];
  total: number;
} {
  const ahora = Date.now();
  const esFuturo = (f: Fila) => new Date(f.starts_at).getTime() > ahora;

  const enMapa = agrupar(
    filas.filter((f) => f.status === "aprobado" && esFuturo(f)),
    "proximo",
  );
  const enRevision = agrupar(
    filas.filter((f) => f.status === "pendiente" && esFuturo(f)),
    "proximo",
  );
  const noPublicado = agrupar(
    filas.filter((f) => f.status === "rechazado"),
    "reciente",
  );
  const yaPasaron = agrupar(
    filas.filter((f) => f.status === "aprobado" && !esFuturo(f)),
    "reciente",
  );

  return {
    enMapa,
    enRevision,
    noPublicado,
    yaPasaron,
    total:
      enMapa.length + enRevision.length + noPublicado.length + yaPasaron.length,
  };
}

// ---------- página ----------

export default async function MisEventos({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: tokenRow } = await supabaseServidor
    .from("access_tokens")
    .select("token, whatsapp")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) notFound();

  // Marca de "visto" — no bloquea el render si falla.
  await supabaseServidor
    .from("access_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token", token);

  const { data: filasRaw } = await supabaseServidor
    .from("events")
    .select(
      "id, title, cover_url, venue_name, starts_at, status, series_id, rejection_reason",
    )
    .eq("whatsapp", normalizarWhatsapp(tokenRow.whatsapp))
    .order("starts_at", { ascending: true });

  const filas = (filasRaw ?? []) as Fila[];
  const { enMapa, enRevision, noPublicado, yaPasaron, total } = repartir(filas);

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>
          envivo.app/mis-eventos/{token.slice(0, 4)}…
        </div>

        <h1 className={styles.tit}>Tus eventos</h1>
        <p className={styles.bajada}>
          Todo lo que has publicado con el {formatearWhatsapp(tokenRow.whatsapp)}.
          Guarda este link: es tu acceso.
        </p>

        {total === 0 ? (
          <p className={styles.vacio}>
            Todavía no hay eventos aprobados ni en revisión con este número. En
            cuanto revisemos tu primera publicación, aparece aquí.
          </p>
        ) : (
          <>
            <Seccion titulo="En el mapa" grupos={enMapa}>
              {(g) => (
                <span className={`${styles.estado} ${styles.ok}`}>
                  {g.total > 1 ? `Publicado · ${g.total} fechas` : "Publicado"}
                </span>
              )}
            </Seccion>

            <Seccion titulo="En revisión" grupos={enRevision}>
              {(g) => (
                <span className={`${styles.estado} ${styles.esp}`}>
                  {g.total > 1
                    ? `Lo revisamos hoy · ${g.total} fechas`
                    : "Lo revisamos hoy"}
                </span>
              )}
            </Seccion>

            <Seccion titulo="No publicado" grupos={noPublicado}>
              {(g) => (
                <span className={`${styles.estado} ${styles.no}`}>
                  {g.rejection_reason?.trim() || "No publicado"}
                </span>
              )}
            </Seccion>

            <Seccion titulo="Ya pasaron" grupos={yaPasaron}>
              {(g) => (
                <span className={`${styles.estado} ${styles.idle}`}>
                  {g.total > 1 ? `${g.total} fechas` : "Ya pasó"}
                </span>
              )}
            </Seccion>
          </>
        )}

        <Link href="/publicar/nuevo" className={styles.enviar}>
          Publicar otro evento
        </Link>
        <p className={styles.pie}>
          ¿Necesitas cambiar algo? Escríbenos por WhatsApp.
        </p>
      </div>
    </div>
  );
}

// ---------- una sección con sus tarjetas ----------

function Seccion({
  titulo,
  grupos,
  children,
}: {
  titulo: string;
  grupos: Grupo[];
  children: (g: Grupo) => ReactNode;
}) {
  if (grupos.length === 0) return null;
  return (
    <>
      <div className={styles.seccion}>{titulo}</div>
      {grupos.map((g) => (
        <div key={g.key} className={styles.item}>
          <div className={styles.prev}>
            {g.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.cover_url} alt={`Flyer de ${g.title}`} />
            ) : (
              <span className={styles.sinFlyer}>Sin flyer</span>
            )}
          </div>
          <div className={styles.datos}>
            <b>{g.title}</b>
            <small>{subtitulo(g)}</small>
            {children(g)}
          </div>
        </div>
      ))}
    </>
  );
}
