"use client";

// Pantalla del organizador: el mismo mapa de eventos, con un botón grande
// "Publicar evento" que lleva al formulario. Sin registro, sin login.
// Sigue el bloque "0 · Inicio del organizador" de
// envivo-pantallas-organizador.html.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import {
  dentroDeCaja,
  GRANADA_CALI,
  leerEdad,
  leerFechas,
  leerFiltro,
  leerPrecio,
  leerTipos,
  pasaFiltroEdad,
  pasaPrecio,
  pasaTipos,
  queryFiltros,
  rangoFiltro,
  type EventoPublico,
} from "@/lib/eventos";
import Filtros, { type EstadoFiltros } from "@/components/Filtros";
import { TILES_ATRIBUCION } from "@/lib/mapaTiles";
import styles from "./page.module.css";
import Logo from "@/components/Logo";

const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

// En esta pantalla no hay control de radio: se fija en 3 km solo para
// dibujar el aro de referencia alrededor del punto.
const RADIO_KM = 3;

// `useSearchParams` obliga a un límite de Suspense en la página.
export default function Publicar() {
  return (
    <Suspense fallback={<div className={styles.mapaCargando}>Cargando…</div>}>
      <PublicarPantalla />
    </Suspense>
  );
}

function PublicarPantalla() {
  const sp = useSearchParams();
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  // Mismos filtros que / y /lista (hoja components/Filtros), leídos y
  // guardados en la URL (?t=&fd=&fh=&p=&ed=&tipos=).
  const [filtros, setFiltros] = useState<EstadoFiltros>(() => ({
    filtro: leerFiltro(sp.get("t")),
    fechas: leerFechas(sp),
    precio: leerPrecio(sp.get("p")),
    edad: leerEdad(sp.get("ed")),
    tipos: leerTipos(sp.get("tipos")),
  }));
  const [centro, setCentro] = useState(GRANADA_CALI);
  const [movido, setMovido] = useState(false);
  const movidoRef = useRef(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (movidoRef.current) return;
        setCentro({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const moverCentro = useCallback((lat: number, lng: number) => {
    movidoRef.current = true;
    setMovido(true);
    setCentro({ lat, lng });
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("eventos_publicos")
        .select("*")
        .gte("starts_at", desde)
        .order("starts_at", { ascending: true });
      if (vivo) setEventos((data as EventoPublico[]) ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const { filtro, precio, edad, tipos, fechas } = filtros;
    const qs = queryFiltros(filtro, precio, edad, undefined, undefined, tipos, fechas);
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [filtros]);

  const visibles = useMemo(() => {
    const { filtro, fechas, precio, edad, tipos } = filtros;
    const { desde, hasta } = rangoFiltro(filtro, new Date(), fechas);
    return eventos.filter((ev) => {
      if (ev.latitude == null || ev.longitude == null) return false;
      if (!pasaPrecio(ev, precio)) return false;
      if (!pasaFiltroEdad(ev, edad)) return false;
      if (!pasaTipos(ev, tipos)) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return dentroDeCaja(ev, centro, RADIO_KM);
    });
  }, [eventos, filtros, centro]);

  return (
    <div className={styles.pantalla}>
      {/* El mapa a pantalla completa, detrás de todo. */}
      <div className={styles.lienzo}>
        <Mapa
          eventos={visibles}
          centro={centro}
          radioKm={RADIO_KM}
          anclado={!movido}
          volarId={0}
          seleccionadoId={null}
          onSeleccionar={() => {}}
          onMoverCentro={moverCentro}
        />
      </div>

      {/* Marca: directamente sobre el mapa, arriba a la izquierda. */}
      <div className={styles.marca}>
        <Logo />
      </div>

      {/* Volver + "Mis eventos": cápsulas de cristal, arriba a la derecha. */}
      <div className={styles.accionesTop}>
        <Link href="/" className={styles.volver}>
          Volver
        </Link>
        <Link href="/mis-eventos" className={styles.misEventos}>
          Mis eventos
        </Link>
      </div>

      {/* Filtros: el mismo botón y la misma hoja que en / y /lista. */}
      <div className={styles.filtros}>
        <Filtros
          valor={filtros}
          onCambiar={(c) => setFiltros((f) => ({ ...f, ...c }))}
          total={visibles.length}
        />
      </div>

      {/* Pie flotante: botón de publicar. */}
      <div className={styles.pie}>
        <Link href="/publicar/nuevo" className={styles.fab}>
          Publicar evento
        </Link>
      </div>

      {/* Atribución de Leaflet: obligatoria, discreta, esquina inferior derecha. */}
      <p className={styles.atribucion}>{TILES_ATRIBUCION}</p>
    </div>
  );
}
