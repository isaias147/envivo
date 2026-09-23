"use client";

// Chips de categoría (campo `type` de events), bajo la barra de búsqueda,
// estilo "chips de Google Maps": fila horizontal con scroll, ícono + texto,
// selección múltiple (ninguno activo = todas las categorías). Compartido
// por el mapa (/) y la lista (/lista) — cada página guarda la selección en
// `?tipos=` (ver queryFiltros en lib/eventos.ts) y filtra con `pasaTipos`.

import { TIPOS_EVENTO } from "@/lib/eventos";
import styles from "./FiltroTipos.module.css";

function IconoMusica() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function IconoTaller() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5z" />
      <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v18h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}
function IconoRecreativo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
function IconoCultural() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18M4 21V10l8-5 8 5v11" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}
function IconoDeportivo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7v10M18 7v10" />
      <rect x="3" y="9" width="3" height="6" rx="0.5" />
      <rect x="18" y="9" width="3" height="6" rx="0.5" />
      <path d="M6 12h12" />
    </svg>
  );
}
function IconoEspiritual() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21c4 0 6-2.6 6-6.2 0-3-1.8-4.7-2.9-6.6.1 2-1 2.8-1.8 2.8-1.7 0-2.5-1.8-2.3-3.7C9.3 8.9 6 11.6 6 14.8 6 18.4 8 21 12 21Z" />
    </svg>
  );
}

const ICONOS: Record<string, () => React.JSX.Element> = {
  musica_en_vivo: IconoMusica,
  clase_taller: IconoTaller,
  recreativo: IconoRecreativo,
  cultural: IconoCultural,
  deportivo: IconoDeportivo,
  espiritual: IconoEspiritual,
};

export default function FiltroTipos({
  valor,
  onCambiar,
}: {
  valor: string[];
  onCambiar: (v: string[]) => void;
}) {
  function alternar(tipo: string) {
    onCambiar(
      valor.includes(tipo) ? valor.filter((t) => t !== tipo) : [...valor, tipo],
    );
  }

  return (
    <div className={styles.fila}>
      {TIPOS_EVENTO.map((t) => {
        const Icono = ICONOS[t.valor];
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
            {Icono && <Icono />}
            {t.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
