"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import {
  dentroDeCaja,
  GRANADA_CALI,
  RADIOS_KM,
  rangoFiltro,
  type EventoPublico,
  type Filtro,
  type RadioKm,
} from "@/lib/eventos";
import TarjetaEvento from "@/components/TarjetaEvento";
import { TILES_ATRIBUCION } from "@/lib/mapaTiles";
import styles from "./page.module.css";

// El mapa se carga solo en el navegador (Leaflet necesita `window`).
const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
  { id: "proximos", etiqueta: "Próximos" },
];

// Filtro de precio: se combina con el de tiempo. "todo" no filtra nada.
type Precio = "todo" | "gratis" | "cover";
const PRECIOS: { id: Precio; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "gratis", etiqueta: "Gratis" },
  { id: "cover", etiqueta: "Con cover" },
];

export default function Home() {
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("hoy");
  const [precio, setPrecio] = useState<Precio>("todo");
  const [radioKm, setRadioKm] = useState<RadioKm>(3);
  // `centro` = punto de referencia del mapa (movible).
  // `gps` = ubicación real del navegador, si la concedió.
  // `movido` = el usuario arrastró o recolocó el punto a mano.
  const [centro, setCentro] = useState(GRANADA_CALI);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [movido, setMovido] = useState(false);
  const movidoRef = useRef(false);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const marcarMovido = useCallback((v: boolean) => {
    movidoRef.current = v;
    setMovido(v);
  }, []);

  // Ubicación del navegador; si se niega o falla, se queda en Granada.
  // Solo mueve el centro si el usuario aún no lo recolocó.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(coords);
        if (!movidoRef.current) setCentro(coords);
      },
      () => {}, // permiso negado: se queda en Granada
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // Recolocar el punto (arrastre del pin o pulsación larga en el mapa).
  const moverCentro = useCallback(
    (lat: number, lng: number) => {
      setCentro({ lat, lng });
      marcarMovido(true);
      setSeleccionadoId(null);
    },
    [marcarMovido],
  );

  const volverAMiUbicacion = useCallback(() => {
    if (!gps) return;
    setCentro(gps);
    marcarMovido(false);
    setSeleccionadoId(null);
  }, [gps, marcarMovido]);

  // Trae de una vez los eventos futuros; el filtro se aplica en el cliente.
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

  // Eventos que pasan el filtro de fecha + precio y caen dentro del radio.
  const visibles = useMemo(() => {
    const { desde, hasta } = rangoFiltro(filtro);
    return eventos.filter((ev) => {
      if (ev.latitude == null || ev.longitude == null) return false;
      if (precio === "gratis" && !ev.is_free) return false;
      if (precio === "cover" && ev.is_free) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return dentroDeCaja(ev, centro, radioKm);
    });
  }, [eventos, filtro, precio, centro, radioKm]);

  const seleccionado =
    visibles.find((e) => e.id === seleccionadoId) ?? null;

  // Cambiar de filtro, precio o radio cierra la ficha abierta.
  function cambiarFiltro(f: Filtro) {
    setFiltro(f);
    setSeleccionadoId(null);
  }
  function cambiarPrecio(p: Precio) {
    setPrecio(p);
    setSeleccionadoId(null);
  }
  function cambiarRadio(km: RadioKm) {
    setRadioKm(km);
    setSeleccionadoId(null);
  }

  return (
    <div className={styles.pantalla}>
      {/* El mapa a pantalla completa, detrás de todo. */}
      <div className={styles.lienzo}>
        <Mapa
          eventos={visibles}
          centro={centro}
          radioKm={radioKm}
          anclado={!movido}
          seleccionadoId={seleccionadoId}
          onSeleccionar={setSeleccionadoId}
          onMoverCentro={moverCentro}
        />
      </div>

      {/* Marca: directamente sobre el mapa, arriba a la izquierda. */}
      <div className={styles.marca}>
        En<i>Vivo</i>
      </div>

      {/* "Ver lista": cápsula de cristal, arriba a la derecha. */}
      <Link href="/lista" className={styles.verLista}>
        Ver lista
      </Link>

      {/* Filtros de tiempo: cápsula de cristal bajo la marca. */}
      <div className={styles.reel}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={styles.filtro}
            aria-pressed={filtro === f.id}
            onClick={() => cambiarFiltro(f.id)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {/* Radio: vertical, centrado en el lado derecho. */}
      <div className={styles.radioCol}>
        <span className={styles.radioTitulo}>km</span>
        {RADIOS_KM.map((km) => (
          <button
            key={km}
            type="button"
            className={styles.km}
            aria-pressed={radioKm === km}
            onClick={() => cambiarRadio(km)}
          >
            {km}
          </button>
        ))}
      </div>

      {gps && movido && (
        <button
          type="button"
          className={styles.volverUbicacion}
          onClick={volverAMiUbicacion}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          Volver a mi ubicación
        </button>
      )}

      {error && (
        <p className={styles.aviso}>
          No se pudieron cargar los eventos: {error}
        </p>
      )}

      {/* Pie: barra de precio centrada; sube cuando aparece la tarjeta. */}
      <div className={styles.pie}>
        <div className={styles.precioBarra}>
          {PRECIOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.precio}
              aria-pressed={precio === p.id}
              onClick={() => cambiarPrecio(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        {seleccionado && (
          <div className={styles.ficha}>
            <TarjetaEvento evento={seleccionado} />
          </div>
        )}
      </div>

      {/* Atribución de Leaflet: obligatoria, discreta, esquina inferior derecha. */}
      <p className={styles.atribucion}>{TILES_ATRIBUCION}</p>
    </div>
  );
}
