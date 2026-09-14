"use client";

// FAB de filtro por edad: círculo de cristal con el texto "Edad" (sin
// ícono), separado del grupo Todo/Gratis/Cover, con un desplegable hacia
// ABAJO (anclado a la izquierda del botón). Como el FAB vive pegado abajo
// de la pantalla, el padre (mapa o lista) sube toda la fila de filtros
// mientras el menú está abierto — por eso este componente avisa cada
// cambio por `onAbiertoCambio`, en vez de manejar el desplazamiento acá
// (no tiene cómo saber qué hay debajo en cada pantalla). Se usa igual en
// el mapa (/) y en la lista (/lista) — la lógica de filtro vive en
// lib/eventos.ts (FiltroEdad, pasaFiltroEdad, leerEdad) para no
// duplicarla.

import { useCallback, useEffect, useRef, useState } from "react";
import type { FiltroEdad as FiltroEdadValor } from "@/lib/eventos";
import styles from "./FiltroEdad.module.css";

// Orden de arriba hacia abajo dentro del desplegable.
const OPCIONES: { id: FiltroEdadValor; etiqueta: string }[] = [
  { id: "infantil", etiqueta: "Infantil" },
  { id: "mas_12", etiqueta: "+12" },
  { id: "mas_16", etiqueta: "+16" },
  { id: "mas_18", etiqueta: "+18" },
  { id: "publico", etiqueta: "T/P" },
  { id: "todo", etiqueta: "Todo" },
];

export default function FiltroEdad({
  valor,
  onCambiar,
  onAbiertoCambio,
}: {
  valor: FiltroEdadValor;
  onCambiar: (v: FiltroEdadValor) => void;
  /** Avisa cada vez que el desplegable abre o cierra, para que el padre
   * suba la fila de filtros y el menú (que abre hacia abajo) no quede
   * tapado por lo que haya debajo. */
  onAbiertoCambio?: (abierto: boolean) => void;
}) {
  const [abierto, setAbiertoState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const setAbierto = useCallback(
    (v: boolean) => {
      setAbiertoState(v);
      onAbiertoCambio?.(v);
    },
    [onAbiertoCambio],
  );

  // Cierra el desplegable al tocar afuera (mismo patrón que BarraFlotante).
  useEffect(() => {
    if (!abierto) return;
    function alClicar(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, [abierto, setAbierto]);

  function elegir(v: FiltroEdadValor) {
    onCambiar(v);
    setAbierto(false);
  }

  return (
    <div ref={ref} className={styles.contenedor}>
      <button
        type="button"
        className={styles.fab}
        aria-label="Edad"
        aria-expanded={abierto}
        aria-pressed={valor !== "todo"}
        onClick={() => setAbierto(!abierto)}
      >
        Edad
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
