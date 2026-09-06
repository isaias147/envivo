"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  fechaLargaCali,
  rangoFiltro,
  type EventoPublico,
  type Filtro,
} from "@/lib/eventos";
import TarjetaEvento from "@/components/TarjetaEvento";
import styles from "./page.module.css";

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
  { id: "proximos", etiqueta: "Próximos" },
];

export default function Lista() {
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("hoy");

  // Mismos eventos que el mapa: futuros, con 3 h de gracia hacia atrás.
  // El filtro Hoy / Finde / Próximos se aplica en el cliente.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data, error: err } = await supabase
        .from("eventos_publicos")
        .select("*")
        .gte("starts_at", desde)
        .order("starts_at", { ascending: true });

      if (!vivo) return;
      if (err) setError(err.message);
      else setEventos((data as EventoPublico[]) ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Eventos que pasan el filtro de fecha, agrupados por día.
  const grupos = useMemo(() => {
    const { desde, hasta } = rangoFiltro(filtro);
    const visibles = eventos.filter((ev) => {
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return true;
    });

    const porDia: { fecha: string; eventos: EventoPublico[] }[] = [];
    for (const ev of visibles) {
      const fecha = fechaLargaCali(ev.starts_at);
      const ultimo = porDia[porDia.length - 1];
      if (ultimo && ultimo.fecha === fecha) ultimo.eventos.push(ev);
      else porDia.push({ fecha, eventos: [ev] });
    }
    return porDia;
  }, [eventos, filtro]);

  return (
    <div className={styles.pantalla}>
      <header className={styles.top}>
        <div className={styles.marca}>
          <b>
            En<i>Vivo</i>
          </b>
          <Link href="/" className={styles.verMapa}>
            Ver mapa
          </Link>
        </div>
        <div className={styles.reel}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={styles.filtro}
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className={styles.aviso}>No se pudieron cargar los eventos: {error}</p>
      )}

      <div className={styles.lista}>
        {grupos.length === 0 ? (
          <p className={styles.vacio}>Nada por aquí todavía en este filtro.</p>
        ) : (
          grupos.map((g) => (
            <section key={g.fecha}>
              <h2 className={styles.dia}>{g.fecha}</h2>
              <div className={styles.renglones}>
                {g.eventos.map((ev) => (
                  <TarjetaEvento key={ev.id} evento={ev} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
