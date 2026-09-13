"use client";

// FAB de filtro por edad: círculo de cristal, separado del grupo
// Todo/Gratis/Cover, con un desplegable hacia arriba. Se usa igual en el
// mapa (/) y en la lista (/lista) — la lógica de filtro vive en
// lib/eventos.ts (FiltroEdad, pasaEdad, leerEdad) para no duplicarla.

import { useEffect, useRef, useState } from "react";
import type { FiltroEdad as FiltroEdadValor } from "@/lib/eventos";
import styles from "./FiltroEdad.module.css";

const OPCIONES: { id: FiltroEdadValor; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "publico", etiqueta: "Todo público/Infantil" },
  { id: "mas_12", etiqueta: "+12" },
  { id: "mas_16", etiqueta: "+16" },
  { id: "mas_18", etiqueta: "+18" },
];

const IconoEdad = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10.5" r="1.5" />
    <path d="M4.5 16c0-1.4 1.8-2.5 4-2.5s4 1.1 4 2.5" />
    <path d="M14.5 9h4M14.5 12h4" />
  </svg>
);

export default function FiltroEdad({
  valor,
  onCambiar,
}: {
  valor: FiltroEdadValor;
  onCambiar: (v: FiltroEdadValor) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra el desplegable al tocar afuera (mismo patrón que BarraFlotante).
  useEffect(() => {
    if (!abierto) return;
    function alClicar(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, [abierto]);

  function elegir(v: FiltroEdadValor) {
    onCambiar(v);
    setAbierto(false);
  }

  return (
    <div ref={ref} className={styles.contenedor}>
      <button
        type="button"
        className={styles.fab}
        aria-label="Filtrar por edad"
        aria-expanded={abierto}
        aria-pressed={valor !== "todo"}
        onClick={() => setAbierto((v) => !v)}
      >
        <IconoEdad />
      </button>
      {abierto && (
        <div className={styles.menu}>
          {OPCIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.opcion}
              aria-pressed={valor === o.id}
              onClick={() => elegir(o.id)}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
