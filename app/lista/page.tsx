"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  dentroDeCaja,
  distanciaMetros,
  fechaLargaCali,
  formatoKm,
  horaCali,
  GRANADA_CALI,
  leerCentro,
  leerEdad,
  leerFiltro,
  leerPrecio,
  leerFechas,
  leerRadio,
  leerTipos,
  pasaFiltroEdad,
  pasaPrecio,
  pasaTipos,
  queryFiltros,
  rangoFiltro,
  type EventoPublico,
  type Fechas,
  type Filtro,
  type FiltroEdad as FiltroEdadValor,
  type Precio,
  type RadioKm,
} from "@/lib/eventos";
import type { ResultadoBusqueda } from "@/lib/busqueda";
import Link from "next/link";
import Buscador from "@/components/Buscador";
import SelectorRadio from "@/components/SelectorRadio";
import BotonUbicacion from "@/components/BotonUbicacion";
import BarraPestanas from "@/components/BarraPestanas";
import Logo from "@/components/Logo";
import Filtros, { type EstadoFiltros } from "@/components/Filtros";
import FiltroTipos from "@/components/FiltroTipos";
import styles from "./page.module.css";

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
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Filtros iniciales desde la URL (?t=&p=&km=), para conservarlos al venir del mapa.
  const [filtro, setFiltro] = useState<Filtro>(() => leerFiltro(sp.get("t")));
  const [precio, setPrecio] = useState<Precio>(() => leerPrecio(sp.get("p")));
  const [edad, setEdad] = useState<FiltroEdadValor>(() => leerEdad(sp.get("ed")));
  // Rango de "Fechas" (hoja de filtros): ?fd=&fh=, solo si t=fechas.
  const [fechas, setFechas] = useState<Fechas>(() => leerFechas(sp));
  // Chips de categoría (Música en vivo, Cultural, ...), selección múltiple;
  // [] = todas. Filtro independiente de Todo/Gratis/Cover y de Edad.
  const [tipos, setTipos] = useState<string[]>(() => leerTipos(sp.get("tipos")));
  // Radio compartido con el mapa (?km=), se elige con SelectorRadio.
  const [radioKm, setRadioKm] = useState<RadioKm>(() => leerRadio(sp.get("km")));
  // Punto de referencia para el filtro de distancia. Si venimos del mapa
  // con ?lat=&lng=, arrancamos ahí en vez de en Granada — así el radio no
  // salta al cambiar de vista. Solo se pide geolocalización si se elige un
  // radio (ver `elegirRadio`).
  const [centro, setCentro] = useState(() => leerCentro(sp) ?? GRANADA_CALI);
  // Posición real (GPS), si se conoce: para saber si el punto está "en tu
  // ubicación" (flecha rellena en BotonUbicacion).
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const geoPedidaRef = useRef(false);
  // Id del evento que hay que enfocar apenas `grupos` se recalcule tras
  // elegir un resultado del buscador (ver `irAResultado`).
  const idAEnfocarRef = useRef<string | null>(null);

  // Refleja los filtros y el centro en la URL (sin recargar) para que "Ver
  // mapa" y el botón atrás del navegador los conserven.
  useEffect(() => {
    const qs = queryFiltros(filtro, precio, edad, radioKm, centro, tipos, fechas);
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [filtro, precio, edad, radioKm, centro, tipos, fechas]);

  // Al elegir un radio por primera vez, pedir ubicación (mismo patrón que
  // app/page.tsx); si la niegan o falla, se queda en Granada.
  function elegirRadio(km: RadioKm) {
    setRadioKm(km);
    if (geoPedidaRef.current) return;
    geoPedidaRef.current = true;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(coords);
        setCentro(coords);
      },
      () => {}, // permiso negado: se queda en Granada
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // Si el permiso de ubicación YA estaba concedido, leer el GPS en silencio
  // al abrir (sin mover el punto): solo para pintar bien BotonUbicacion. Si
  // nunca se concedió, no se pregunta nada hasta que toquen el botón.
  useEffect(() => {
    if (!("geolocation" in navigator) || !navigator.permissions) return;
    let vivo = true;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((estado) => {
        if (!vivo || estado.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (vivo) setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 },
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // "Volver a mi ubicación": el punto pasa a la posición real y las
  // distancias de las tarjetas se recalculan solas (dependen de `centro`).
  function irAMiUbicacion(coords: { lat: number; lng: number }) {
    geoPedidaRef.current = true;
    setGps(coords);
    setCentro(coords);
  }
  const enMiUbicacion = gps != null && distanciaMetros(centro, gps) < 50;

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
    const { desde, hasta } = rangoFiltro(filtro, new Date(), fechas);
    const visibles = eventos.filter((ev) => {
      if (!pasaPrecio(ev, precio)) return false;
      if (!pasaFiltroEdad(ev, edad)) return false;
      if (!pasaTipos(ev, tipos)) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      if (ev.latitude == null || ev.longitude == null) return false;
      return dentroDeCaja(ev, centro, radioKm);
    });

    const porDia: { fecha: string; eventos: EventoPublico[] }[] = [];
    for (const ev of visibles) {
      const fecha = fechaLargaCali(ev.starts_at);
      const ultimo = porDia[porDia.length - 1];
      if (ultimo && ultimo.fecha === fecha) ultimo.eventos.push(ev);
      else porDia.push({ fecha, eventos: [ev] });
    }
    return porDia;
  }, [eventos, filtro, fechas, precio, edad, tipos, radioKm, centro]);
  const totalVisibles = grupos.reduce((n, g) => n + g.eventos.length, 0);

  // Hoja de filtros (y chips de arriba): aplica al instante.
  const estadoFiltros: EstadoFiltros = { filtro, fechas, precio, edad, tipos };
  function cambiarFiltros(c: Partial<EstadoFiltros>) {
    if (c.filtro !== undefined) setFiltro(c.filtro);
    if (c.fechas !== undefined) setFechas(c.fechas);
    if (c.precio !== undefined) setPrecio(c.precio);
    if (c.edad !== undefined) setEdad(c.edad);
    if (c.tipos !== undefined) setTipos(c.tipos);
  }

  // Apenas `grupos` se recalcula (por el recentrado de `irAResultado`),
  // si queda un evento pendiente de enfocar y ya está en el DOM, scrollea
  // hasta su tarjeta. Se limpia la referencia para no repetirlo con
  // recálculos posteriores (cambiar de filtro, etc.).
  useEffect(() => {
    const id = idAEnfocarRef.current;
    if (!id) return;
    const el = document.getElementById(`evento-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      idAEnfocarRef.current = null;
    }
  }, [grupos]);

  // El buscador recentra la lista en el resultado en vez de mandar al
  // mapa: mueve `centro` ahí y, si es un evento, scrollea hasta su
  // tarjeta apenas `grupos` lo refleje.
  function irAResultado(resultado: ResultadoBusqueda) {
    if (resultado.latitude != null && resultado.longitude != null) {
      setCentro({ lat: resultado.latitude, lng: resultado.longitude });
    }
    if (resultado.tipo === "evento") {
      idAEnfocarRef.current = resultado.id;
    }
  }

  return (
    <div className={styles.pantalla}>
      <header className={styles.top}>
        <div className={styles.filaSuperior}>
          <div className={styles.buscador}>
            <Buscador onSeleccionar={irAResultado} />
          </div>
          <Filtros valor={estadoFiltros} onCambiar={cambiarFiltros} total={totalVisibles} />
        </div>
        {/* Chips de categoría, debajo del buscador. Filtro aparte de
            Todo/Gratis/Cover, Edad y tiempo: selección múltiple, ninguno
            activo = todas. Envueltos en .tiposWrap para cancelar el
            padding lateral de .top — el gutter real lo da el padding
            propio de FiltroTipos, igual que en el mapa. */}
        <div className={styles.tiposWrap}>
          <FiltroTipos valor={tipos} onCambiar={(t) => cambiarFiltros({ tipos: t })} />
        </div>
        <div className={styles.radio}>
          <SelectorRadio radioKm={radioKm} onCambiar={elegirRadio} />
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
              <ul className={styles.grupo}>
                {g.eventos.map((ev) => {
                  const { hhmm, periodo } = horaCali(ev.starts_at);
                  return (
                    <li key={ev.id}>
                      <Link
                        id={`evento-${ev.id}`}
                        href={`/evento/${ev.id}`}
                        className={styles.renglon}
                      >
                        <span className={styles.punto} data-cat={ev.type ?? ""} aria-hidden="true" />
                        <span className={styles.textos}>
                          <span className={styles.nombre}>{ev.title}</span>
                          <span className={styles.detalle}>
                            {ev.venue_name && `${ev.venue_name} · `}
                            {hhmm} {periodo.toUpperCase()}
                            {ev.is_free && (
                              <>
                                {" · "}
                                <span className={styles.gratis}>Gratis</span>
                              </>
                            )}
                          </span>
                        </span>
                        {ev.latitude != null && ev.longitude != null && (
                          <span className={styles.distancia}>
                            {formatoKm(
                              distanciaMetros(centro, { lat: ev.latitude, lng: ev.longitude }) / 1000,
                              true,
                            )}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Marca: fija abajo a la izquierda, igual que sobre el mapa. */}
      <div className={styles.marca}>
        <Logo />
      </div>

      <BotonUbicacion activo={enMiUbicacion} onUbicacion={irAMiUbicacion} />
      <BarraPestanas />
    </div>
  );
}
