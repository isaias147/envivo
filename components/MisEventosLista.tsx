// La lista de "Mis eventos" en cuatro secciones (En el mapa · En revisión ·
// No publicado · Ya pasaron), con las series agrupadas en una sola tarjeta.
//
// Solo la vista: recibe las filas ya traídas de `events` y las reparte. La
// usa /mis-eventos (cuentas registradas, datos por perfil_id). La pantalla
// vieja /mis-eventos/[token] mantiene su copia propia intacta.

import type { ReactNode } from "react";
import Link from "next/link";
import { horaCali } from "@/lib/eventos";
import styles from "./MisEventosLista.module.css";

export type FilaMisEventos = {
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
  id: string; // id del evento representativo (para el enlace de editar)
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
function agrupar(filas: FilaMisEventos[], modo: "proximo" | "reciente"): Grupo[] {
  const mapa = new Map<string, FilaMisEventos[]>();
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
      id: rep.id,
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
function repartir(filas: FilaMisEventos[]): {
  enMapa: Grupo[];
  enRevision: Grupo[];
  noPublicado: Grupo[];
  yaPasaron: Grupo[];
  total: number;
} {
  const ahora = Date.now();
  const esFuturo = (f: FilaMisEventos) =>
    new Date(f.starts_at).getTime() > ahora;

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

export default function MisEventosLista({
  filas,
  mensajeVacio = "Todavía no hay eventos aprobados ni en revisión. En cuanto revisemos tu primera publicación, aparece aquí.",
}: {
  filas: FilaMisEventos[];
  mensajeVacio?: string;
}) {
  const { enMapa, enRevision, noPublicado, yaPasaron, total } = repartir(filas);

  if (total === 0) {
    return <p className={styles.vacio}>{mensajeVacio}</p>;
  }

  return (
    <>
      <Seccion titulo="En el mapa" grupos={enMapa} editable>
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
  );
}

function Seccion({
  titulo,
  grupos,
  editable = false,
  children,
}: {
  titulo: string;
  grupos: Grupo[];
  editable?: boolean;
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
            {editable && (
              <Link
                href={`/mis-eventos/editar/${g.id}`}
                className={styles.editar}
              >
                Editar flyer, video o ubicación
              </Link>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
