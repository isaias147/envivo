"use client";

// Chips de categoría (campo `type` de events), bajo la barra de búsqueda,
// fila horizontal con scroll. Cada chip: tinte de su categoría siempre
// visible + punto sólido; seleccionado = el punto pasa a ✓ y aparece un aro
// del mismo color (se distingue por forma, no solo por color). Selección
// múltiple (ninguno activo = todas las categorías). Compartido
// por el mapa (/) y la lista (/lista) — cada página guarda la selección en
// `?tipos=` (ver queryFiltros en lib/eventos.ts) y filtra con `pasaTipos`.

import { TIPOS_EVENTO } from "@/lib/eventos";
import styles from "./FiltroTipos.module.css";

export default function FiltroTipos({
  valor,
  onCambiar,
  envolver = false,
}: {
  valor: string[];
  onCambiar: (v: string[]) => void;
  /** En varias filas (dentro de la hoja de filtros) en vez de una fila con scroll. */
  envolver?: boolean;
}) {
  function alternar(tipo: string) {
    onCambiar(
      valor.includes(tipo) ? valor.filter((t) => t !== tipo) : [...valor, tipo],
    );
  }

  return (
    <div className={`${styles.fila} ${envolver ? styles.envuelta : ""}`}>
      {TIPOS_EVENTO.map((t) => {
        const activo = valor.includes(t.valor);
        return (
          <button
            key={t.valor}
            type="button"
            className={styles.chip}
            data-cat={t.valor}
            aria-pressed={activo}
            onClick={() => alternar(t.valor)}
          >
            {activo ? (
              <svg className={styles.marca} viewBox="0 0 12 12" aria-hidden="true">
                <path d="m2.5 6.2 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className={styles.punto} aria-hidden="true" />
            )}
            {t.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
