"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  dentroDeCaja,
  fechaLargaCali,
  GRANADA_CALI,
  leerFiltro,
  leerPrecio,
  leerRadio,
  pasaPrecio,
  queryFiltros,
  RADIOS_KM,
  rangoFiltro,
  type EventoPublico,
  type Filtro,
  type Precio,
  type RadioKm,
} from "@/lib/eventos";
import type { ResultadoBusqueda } from "@/lib/busqueda";
import TarjetaEvento from "@/components/TarjetaEvento";
import Buscador from "@/components/Buscador";
import BarraInferior from "@/components/BarraInferior";
import EnlaceCuenta from "@/components/EnlaceCuenta";
import styles from "./page.module.css";

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
  { id: "proximos", etiqueta: "Próximos" },
];

// Etiquetas del filtro de precio (el tipo y la lógica viven en lib/eventos).
const PRECIOS: { id: Precio; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "gratis", etiqueta: "Gratis" },
  { id: "cover", etiqueta: "Con cover" },
];

// `useSearchParams` obliga a un límite de Suspense en la página.
export default function Lista() {
  return (
    <Suspense fallback={null}>
      <ListaPantalla />
    </Suspense>
  );
}

function ListaPantalla() {
  const sp = useSearchParams();
  const router = useRouter();
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Filtros iniciales desde la URL (?t=&p=&km=), para conservarlos al venir del mapa.
  const [filtro, setFiltro] = useState<Filtro>(() => leerFiltro(sp.get("t")));
  const [precio, setPrecio] = useState<Precio>(() => leerPrecio(sp.get("p")));
  const [radioKm, setRadioKm] = useState<RadioKm | "todo">(() =>
    leerRadio(sp.get("km")),
  );
  // Punto de referencia para el filtro de distancia. Por defecto Granada;
  // solo se pide geolocalización si se elige un radio (ver `elegirRadio`).
  const [centro, setCentro] = useState(GRANADA_CALI);
  const geoPedidaRef = useRef(false);

  // Refleja los filtros en la URL (sin recargar) para que "Ver mapa" y el
  // botón atrás del navegador los conserven.
  useEffect(() => {
    const qs = queryFiltros(filtro, precio, radioKm);
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [filtro, precio, radioKm]);

  // Al elegir un radio por primera vez, pedir ubicación (mismo patrón que
  // app/page.tsx); si la niegan o falla, se queda en Granada.
  function elegirRadio(km: RadioKm | "todo") {
    setRadioKm(km);
    if (km === "todo" || geoPedidaRef.current) return;
    geoPedidaRef.current = true;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCentro({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {}, // permiso negado: se queda en Granada
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // Mismos eventos que el mapa: futuros, con 3 h de gracia hacia atrás.
  // Los filtros de tiempo y precio se aplican en el cliente.
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

  // Eventos que pasan el filtro de fecha + precio + distancia, agrupados por día.
  const grupos = useMemo(() => {
    const { desde, hasta } = rangoFiltro(filtro);
    const visibles = eventos.filter((ev) => {
      if (!pasaPrecio(ev, precio)) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      if (radioKm !== "todo") {
        if (ev.latitude == null || ev.longitude == null) return false;
        if (!dentroDeCaja(ev, centro, radioKm)) return false;
      }
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
  }, [eventos, filtro, precio, radioKm, centro]);

  // El buscador acá es solo para ubicarse en el mapa: no abre nada en la
  // lista, redirige a `/` con el resultado marcado.
  function irAResultado(resultado: ResultadoBusqueda) {
    router.push(`/?resaltar=${resultado.id}&tipo=${resultado.tipo}`);
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.top}>
        <div className={styles.marca}>
          <b>
            En<i>Vivo</i>
          </b>
          <EnlaceCuenta />
        </div>
        <div className={styles.buscador}>
          <Buscador onSeleccionar={irAResultado} />
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

      {/* Filtros de distancia y de precio: cápsulas de cristal flotando
          abajo, centradas, igual que en el mapa. Se combinan con el filtro
          de tiempo. La de distancia pide ubicación la primera vez que se
          elige un radio (ver `elegirRadio`). */}
      <div className={styles.pie}>
        <div className={styles.precioBarra}>
          <button
            type="button"
            className={styles.precio}
            aria-pressed={radioKm === "todo"}
            onClick={() => elegirRadio("todo")}
          >
            Ver todo
          </button>
          {RADIOS_KM.map((km) => (
            <button
              key={km}
              type="button"
              className={styles.precio}
              aria-pressed={radioKm === km}
              onClick={() => elegirRadio(km)}
            >
              {km} km
            </button>
          ))}
        </div>
        <div className={styles.precioBarra}>
          {PRECIOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.precio}
              aria-pressed={precio === p.id}
              onClick={() => setPrecio(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <BarraInferior />
    </div>
  );
}
