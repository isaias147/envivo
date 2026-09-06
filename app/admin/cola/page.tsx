"use client";

// Pantalla 8 · /admin/cola — la cola de trabajo del administrador.
// Sigue el bloque "2 · Cola de aprobación" de envivo-panel-admin.html.
//
// - Tres pestañas: Por revisar · Duplicados · Aprobados hoy.
// - Cada pendiente: flyer, hora + fecha, datos, mini-mapa, y si es serie
//   las fechas agrupadas en chips.
// - Botones Aprobar / Rechazar / "Otros de este WhatsApp".
// - Duplicados: pares de `posibles_duplicados` con opción de Fusionar.
// - Toda escritura pasa por /api/admin/* (nunca Supabase desde aquí).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { horaCali } from "@/lib/eventos";
import styles from "./page.module.css";

const MapaMini = dynamic(() => import("@/components/MapaMini"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando} />,
});

// ---------- tipos que devuelve /api/admin/cola ----------

type Evento = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  cover_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  is_free: boolean | null;
  price_label: string | null;
  series_id: string | null;
  publisher_type: string | null;
  publisher_name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  post_url: string | null;
  artist_name: string | null;
  artist_instagram: string | null;
  status: string | null;
  created_at: string | null;
};

type Tarjeta = Evento & {
  key: string;
  esSerie: boolean;
  ids: string[];
  fechas: string[];
  total: number;
  posibleDuplicado: boolean;
};

type Duplicado = {
  venue_name: string | null;
  starts_at: string;
  a: Evento;
  b: Evento;
};

type OtroEvento = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  status: string | null;
  is_free: boolean | null;
  price_label: string | null;
  series_id: string | null;
  publisher_name: string | null;
  publisher_type: string | null;
};

// ---------- formato de fechas en hora de Cali ----------

function horaTexto(iso: string): string {
  const { hhmm, periodo } = horaCali(iso);
  return `${hhmm} ${periodo}`;
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

/** "17 sep" — para los chips de la serie. */
function diaMes(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
  })
    .format(new Date(iso))
    .replace(".", "");
}

const TIPO_ETIQUETA: Record<string, string> = {
  musica_en_vivo: "Música en vivo",
  clase_taller: "Clase o taller",
  recreativo: "Recreativo",
  cultural: "Cultural",
  deportivo: "Deportivo",
};

const ESTADO_ETIQUETA: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

function estadoClase(status: string | null): string {
  if (status === "aprobado") return styles.e_aprobado;
  if (status === "rechazado") return styles.e_rechazado;
  if (status === "pendiente") return styles.e_pendiente;
  return "";
}

// ---------- página ----------

type Estado = "cargando" | "listo" | "error";

export default function AdminCola() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [pendientes, setPendientes] = useState<Tarjeta[]>([]);
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [aprobadosHoy, setAprobadosHoy] = useState(0);
  const [tab, setTab] = useState<"pend" | "dup" | "hoy">("pend");

  // Se incrementa para forzar una recarga (botón "Reintentar").
  const [intento, setIntento] = useState(0);
  const recargar = useCallback(() => {
    setEstado("cargando");
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/cola", { cache: "no-store" });
        if (!vivo) return;
        if (r.status === 401) {
          router.replace("/admin");
          return;
        }
        if (r.status === 403) {
          router.replace("/admin/cambiar-pin");
          return;
        }
        if (!r.ok) {
          setEstado("error");
          return;
        }
        const j = await r.json();
        if (!vivo) return;
        setPendientes(j.pendientes ?? []);
        setDuplicados(j.duplicados ?? []);
        setAprobadosHoy(j.aprobadosHoy ?? 0);
        setEstado("listo");
      } catch {
        if (vivo) setEstado("error");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [router, intento]);

  // Quita de la vista una tarjeta y los pares de duplicados que la tocan.
  const sacarDeLaCola = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setPendientes((prev) => prev.filter((t) => !t.ids.some((i) => set.has(i))));
    setDuplicados((prev) =>
      prev.filter((d) => !set.has(d.a.id) && !set.has(d.b.id)),
    );
  }, []);

  async function aprobar(t: Tarjeta) {
    const r = await fetch("/api/admin/aprobar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: t.ids }),
    });
    if (r.ok) {
      sacarDeLaCola(t.ids);
      setAprobadosHoy((n) => n + 1);
    } else {
      alert("No se pudo aprobar. Intenta de nuevo.");
    }
  }

  async function rechazar(t: Tarjeta, motivo: string) {
    const r = await fetch("/api/admin/rechazar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: t.ids, motivo }),
    });
    if (r.ok) sacarDeLaCola(t.ids);
    else alert("No se pudo rechazar. Intenta de nuevo.");
  }

  async function fusionar(d: Duplicado) {
    const r = await fetch("/api/admin/fusionar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_a: d.a.id, id_b: d.b.id }),
    });
    if (r.ok) {
      // Se aprobó uno y se cerró el otro: los dos salen de pendientes.
      sacarDeLaCola([d.a.id, d.b.id]);
      setAprobadosHoy((n) => n + 1);
    } else {
      const j = await r.json().catch(() => ({}));
      alert(j.error ?? "No se pudo fusionar.");
    }
  }

  async function rechazarPar(d: Duplicado) {
    const r = await fetch("/api/admin/rechazar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [d.a.id, d.b.id],
        motivo: "Rechazados como duplicados",
      }),
    });
    if (r.ok) sacarDeLaCola([d.a.id, d.b.id]);
    else alert("No se pudo rechazar.");
  }

  function separarPar(d: Duplicado) {
    // "Son eventos distintos": solo se quita el aviso, sin tocar la base.
    setDuplicados((prev) =>
      prev.filter((x) => !(x.a.id === d.a.id && x.b.id === d.b.id)),
    );
  }

  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
  }

  const conteoPend = pendientes.length;
  const conteoDup = duplicados.length;

  return (
    <div className={styles.pantalla}>
      <div className={styles.taller}>
        <div className={styles.barra}>
          <div className={styles.marca}>
            En<i>Vivo</i>
            <em>Panel de revisión</em>
          </div>
          <div className={styles.derecha}>
            <div className={styles.pestanas}>
              <button
                type="button"
                className={styles.p}
                aria-pressed={tab === "pend"}
                onClick={() => setTab("pend")}
              >
                Por revisar <b>{conteoPend}</b>
              </button>
              <button
                type="button"
                className={styles.p}
                aria-pressed={tab === "dup"}
                onClick={() => setTab("dup")}
              >
                Duplicados <b>{conteoDup}</b>
              </button>
              <button
                type="button"
                className={styles.p}
                aria-pressed={tab === "hoy"}
                onClick={() => setTab("hoy")}
              >
                Aprobados hoy <b>{aprobadosHoy}</b>
              </button>
            </div>
            <button type="button" className={styles.salir} onClick={salir}>
              Salir
            </button>
          </div>
        </div>

        <div className={styles.cola}>
          {estado === "cargando" && (
            <p className={styles.nota}>Cargando la cola…</p>
          )}
          {estado === "error" && (
            <p className={styles.nota}>
              No se pudo cargar la cola.{" "}
              <button
                type="button"
                className={styles.reintentar}
                onClick={recargar}
              >
                Reintentar
              </button>
            </p>
          )}

          {estado === "listo" && tab === "pend" && (
            <>
              {pendientes.length === 0 ? (
                <div className={styles.vacio}>
                  <b>Cola limpia</b>
                  No queda nada por revisar. Los eventos aprobados ya están en
                  el mapa.
                </div>
              ) : (
                pendientes.map((t) => (
                  <TarjetaPendiente
                    key={t.key}
                    t={t}
                    onAprobar={() => aprobar(t)}
                    onRechazar={(motivo) => rechazar(t, motivo)}
                  />
                ))
              )}
            </>
          )}

          {estado === "listo" && tab === "dup" && (
            <>
              {duplicados.length === 0 ? (
                <div className={styles.vacio}>
                  <b>Sin duplicados</b>
                  No hay dos publicaciones para el mismo lugar, día y hora.
                </div>
              ) : (
                duplicados.map((d) => (
                  <TarjetaDuplicado
                    key={`${d.a.id}-${d.b.id}`}
                    d={d}
                    onFusionar={() => fusionar(d)}
                    onSeparar={() => separarPar(d)}
                    onRechazar={() => rechazarPar(d)}
                  />
                ))
              )}
            </>
          )}

          {estado === "listo" && tab === "hoy" && (
            <div className={styles.vacio}>
              <b>
                {aprobadosHoy} {aprobadosHoy === 1 ? "evento" : "eventos"} hoy
              </b>
              {aprobadosHoy === 0
                ? "Todavía no has aprobado nada hoy."
                : "Ya están en el mapa. El contador vuelve a cero mañana."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- tarjeta de un pendiente ----------

function TarjetaPendiente({
  t,
  onAprobar,
  onRechazar,
}: {
  t: Tarjeta;
  onAprobar: () => void;
  onRechazar: (motivo: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [otros, setOtros] = useState<OtroEvento[] | "cargando" | null>(null);

  const tieneMapa = t.latitude != null && t.longitude != null;

  const chipsFechas = useMemo(() => {
    if (!t.esSerie) return null;
    const visibles = t.fechas.slice(0, 5).map(diaMes);
    const resto = t.fechas.length - visibles.length;
    return { visibles, resto };
  }, [t]);

  async function verOtros() {
    if (otros && otros !== "cargando") {
      setOtros(null);
      return;
    }
    if (!t.whatsapp) return;
    setOtros("cargando");
    try {
      const r = await fetch(
        `/api/admin/eventos?whatsapp=${encodeURIComponent(t.whatsapp)}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      setOtros(
        (j.eventos ?? []).filter((e: OtroEvento) => !t.ids.includes(e.id)),
      );
    } catch {
      setOtros([]);
    }
  }

  async function hacer(fn: () => Promise<void> | void) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await fn();
    } finally {
      setOcupado(false);
    }
  }

  const precio = t.is_free ? "Gratis" : t.price_label ?? "Entrada paga";

  return (
    <article className={styles.tarjeta}>
      <div className={styles.flyer}>
        {t.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.cover_url} alt={`Flyer de ${t.title}`} />
        ) : (
          <div className={styles.flyerVacio}>Sin flyer</div>
        )}
      </div>

      <div className={styles.cuerpo}>
        <div className={styles.lineaAlta}>
          <span className={styles.hora}>{horaTexto(t.starts_at)}</span>
          <span className={styles.cuando}>{fechaCorta(t.starts_at)}</span>
        </div>
        <h3>{t.title}</h3>
        {t.description && <p className={styles.desc}>{t.description}</p>}

        <div className={styles.meta}>
          {t.type && TIPO_ETIQUETA[t.type] && (
            <span className={styles.tg}>{TIPO_ETIQUETA[t.type]}</span>
          )}
          <span className={`${styles.tg} ${t.is_free ? styles.libre : ""}`}>
            {precio}
          </span>
          {t.esSerie && (
            <span className={`${styles.tg} ${styles.serie}`}>
              {t.total} {t.total === 1 ? "fecha" : "fechas"}
            </span>
          )}
          {t.publisher_type === "artista" && (
            <span className={`${styles.tg} ${styles.alerta}`}>
              Publica un artista · confirma el WhatsApp del local
            </span>
          )}
          {t.posibleDuplicado && (
            <span className={`${styles.tg} ${styles.alerta}`}>
              Posible duplicado
            </span>
          )}
        </div>

        {chipsFechas && (
          <p className={styles.fechas}>
            Serie:{" "}
            {chipsFechas.visibles.map((f) => (
              <span key={f}>{f}</span>
            ))}
            {chipsFechas.resto > 0 && <span>+{chipsFechas.resto} más</span>}
          </p>
        )}

        <p className={styles.quien}>
          Publica <b>{t.publisher_name ?? "—"}</b>
          {t.publisher_type ? ` · ${t.publisher_type}` : ""}
          {t.venue_name ? ` · ${t.venue_name}` : ""}
          {t.whatsapp ? ` · WhatsApp ${t.whatsapp}` : " · sin WhatsApp"}
          {t.instagram ? ` · IG ${t.instagram}` : ""}
          {t.tiktok ? ` · TikTok ${t.tiktok}` : ""}
          {t.post_url && (
            <>
              {" · "}
              <a href={t.post_url} target="_blank" rel="noopener noreferrer">
                reel
              </a>
            </>
          )}
        </p>

        {rechazando ? (
          <div className={styles.rechazoCaja}>
            <input
              className={styles.motivo}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional, se guarda)"
              maxLength={200}
            />
            <div className={styles.acciones}>
              <button
                type="button"
                className={styles.no}
                disabled={ocupado}
                onClick={() => hacer(() => onRechazar(motivo))}
              >
                Confirmar rechazo
              </button>
              <button
                type="button"
                className={styles.ver}
                onClick={() => {
                  setRechazando(false);
                  setMotivo("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.acciones}>
            <button
              type="button"
              className={styles.si}
              disabled={ocupado}
              onClick={() => hacer(onAprobar)}
            >
              {t.esSerie ? `Aprobar ${t.total} fechas` : "Aprobar"}
            </button>
            <button
              type="button"
              className={styles.no}
              onClick={() => setRechazando(true)}
            >
              Rechazar
            </button>
            {t.whatsapp && (
              <button type="button" className={styles.ver} onClick={verOtros}>
                {otros && otros !== "cargando"
                  ? "Ocultar"
                  : "Otros de este WhatsApp"}
              </button>
            )}
          </div>
        )}

        {otros === "cargando" && (
          <p className={styles.otrosNota}>Buscando…</p>
        )}
        {Array.isArray(otros) && (
          <div className={styles.otros}>
            {otros.length === 0 ? (
              <p className={styles.otrosNota}>
                No hay más eventos con este WhatsApp.
              </p>
            ) : (
              otros.map((e) => (
                <div key={e.id} className={styles.otroItem}>
                  <span className={styles.otroFecha}>
                    {fechaCorta(e.starts_at)} · {horaTexto(e.starts_at)}
                  </span>
                  <span className={styles.otroTitulo}>{e.title}</span>
                  <span
                    className={`${styles.otroEstado} ${estadoClase(e.status)}`}
                  >
                    {e.status ? ESTADO_ETIQUETA[e.status] ?? e.status : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className={styles.mapita}>
        {tieneMapa ? (
          <MapaMini lat={t.latitude as number} lng={t.longitude as number} />
        ) : (
          <div className={styles.mapaCargando}>Sin ubicación</div>
        )}
      </div>
    </article>
  );
}

// ---------- tarjeta de un par de duplicados ----------

function TarjetaDuplicado({
  d,
  onFusionar,
  onSeparar,
  onRechazar,
}: {
  d: Duplicado;
  onFusionar: () => Promise<void>;
  onSeparar: () => void;
  onRechazar: () => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function hacer(fn: () => Promise<void> | void) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await fn();
    } finally {
      setOcupado(false);
    }
  }

  const cuando = `${fechaCorta(d.starts_at)} · ${horaTexto(d.starts_at)}`;

  return (
    <article className={`${styles.tarjeta} ${styles.fusion}`}>
      <p className={styles.avisoFusion}>
        Dos publicaciones para {d.venue_name ?? "el mismo lugar"}, {cuando}. Si
        son el mismo evento, fusiónalas: queda un solo pin con el artista
        acreditado y el WhatsApp del local.
      </p>
      <div className={styles.parFusion}>
        <MitadDup ev={d.a} />
        <MitadDup ev={d.b} />
      </div>
      <div className={styles.acciones}>
        <button
          type="button"
          className={styles.mezcla}
          disabled={ocupado}
          onClick={() => hacer(onFusionar)}
        >
          Fusionar en un evento
        </button>
        <button type="button" className={styles.ver} onClick={onSeparar}>
          Son eventos distintos
        </button>
        <button
          type="button"
          className={styles.no}
          disabled={ocupado}
          onClick={() => hacer(onRechazar)}
        >
          Rechazar los dos
        </button>
      </div>
    </article>
  );
}

function MitadDup({ ev }: { ev: Evento }) {
  const quien =
    ev.publisher_type === "artista"
      ? "Publicó el artista"
      : ev.publisher_type === "local"
        ? "Publicó el local"
        : "Publicó el organizador";
  return (
    <div className={styles.mitad}>
      <small>
        {quien}
        {ev.status && ev.status !== "pendiente"
          ? ` · ${ESTADO_ETIQUETA[ev.status] ?? ev.status}`
          : ""}
      </small>
      <b>{ev.title}</b>
      <p>
        {ev.venue_name ?? "—"} · {fechaCorta(ev.starts_at)},{" "}
        {horaTexto(ev.starts_at)}
        <br />
        {ev.whatsapp ? `WhatsApp ${ev.whatsapp}` : "Sin WhatsApp"}
        {ev.cover_url ? " · con flyer" : " · sin flyer"}
        {ev.post_url ? " · con reel" : ""}
      </p>
    </div>
  );
}
