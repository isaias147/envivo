"use client";

// Círculo flotante (FAB) del mapa, abajo a la derecha, encima de la barra
// de pestañas: vuelve a la ubicación real. La navegación se mudó a
// BarraPestanas y a /yo; el radio, a SelectorRadio. Lo reemplaza la sesión
// de ubicación.

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import styles from "./BarraFlotante.module.css";

type Props = {
  ubicacionMapa?: { disponible: boolean; onClick: () => void };
  /** Alto (px) de la ficha abierta sobre la columna: la sube esa medida
   * exacta en vez de dejar que la tape. Solo la pasa el mapa. */
  alturaExtra?: number;
};

const IconoUbicacion = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

function BarraFlotanteContenido({
  ubicacionMapa,
  alturaExtra = 0,
}: Props) {
  const path = usePathname();

  return (
    <nav
      className={styles.columna}
      aria-label="Ubicación"
      style={{
        bottom: alturaExtra
          ? `calc(env(safe-area-inset-bottom) + var(--barra-inf) + 168px + ${alturaExtra}px)`
          : undefined,
      }}
    >
      {/* Volver a la ubicación real (solo en el mapa). */}
      {path === "/" && ubicacionMapa && (
        <button
          type="button"
          className={styles.circulo}
          aria-label="Volver a mi ubicación"
          disabled={!ubicacionMapa.disponible}
          onClick={ubicacionMapa.onClick}
        >
          <IconoUbicacion />
        </button>
      )}
    </nav>
  );
}

export default function BarraFlotante(props: Props) {
  return (
    <Suspense fallback={null}>
      <BarraFlotanteContenido {...props} />
    </Suspense>
  );
}
