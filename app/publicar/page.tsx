"use client";

// Pantalla del organizador: el mismo mapa de eventos, con un botón grande
// "Publicar evento" que lleva al formulario. Sin registro, sin login.
// Sigue el bloque "0 · Inicio del organizador" de
// envivo-pantallas-organizador.html.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import {
  dentroDeCaja,
  GRANADA_CALI,
  rangoFiltro,
  type EventoPublico,
  type Filtro,
} from "@/lib/eventos";
import { TILES_ATRIBUCION } from "@/lib/mapaTiles";
import styles from "./page.module.css";

const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
  { id: "proximos", etiqueta: "Próximos" },
];

// En esta pantalla no hay control de radio: se fija en 3 km solo para
// dibujar el aro de referencia alrededor del punto.
const RADIO_KM = 3;

export default function Publicar() {
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("hoy");
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

  const visibles = useMemo(() => {
    const { desde, hasta } = rangoFiltro(filtro);
    return eventos.filter((ev) => {
      if (ev.latitude == null || ev.longitude == null) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return dentroDeCaja(ev, centro, RADIO_KM);
    });
  }, [eventos, filtro, centro]);

  return (
    <div className={styles.pantalla}>
      {/* El mapa a pantalla completa, detrás de todo. */}
      <div className={styles.lienzo}>
        <Mapa
          eventos={visibles}
          centro={centro}
          radioKm={RADIO_KM}
          anclado={!movido}
          seleccionadoId={null}
          onSeleccionar={() => {}}
          onMoverCentro={moverCentro}
        />
      </div>

      {/* Marca: directamente sobre el mapa, arriba a la izquierda. */}
      <div className={styles.marca}>
        En<i>Vivo</i>
      </div>

      {/* "Mis eventos": cápsula de cristal, arriba a la derecha. */}
      <Link href="/mis-eventos" className={styles.misEventos}>
        Mis eventos
      </Link>

      {/* Filtros de tiempo: cápsula de cristal bajo la marca. */}
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
