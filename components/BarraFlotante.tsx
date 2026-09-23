"use client";

// Círculo flotante (FAB), abajo a la derecha, encima de la barra de
// pestañas. La navegación (Mapa/Lista, Siguiendo, Publicar) se mudó a
// BarraPestanas y a /yo; acá quedó solo el círculo que cambia de función
// según la página (ver Props): en el mapa vuelve a la ubicación real; en la
// lista abre un desplegable para elegir el radio. Lo reemplazan las
// sesiones de radio y ubicación.

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RADIOS_KM, type RadioKm } from "@/lib/eventos";
import styles from "./BarraFlotante.module.css";

type Props = {
  ubicacionMapa?: { disponible: boolean; onClick: () => void };
  ubicacionLista?: {
    radioKm: RadioKm | "todo";
    onCambiar: (km: RadioKm | "todo") => void;
  };
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
  ubicacionLista,
  alturaExtra = 0,
}: Props) {
  const path = usePathname();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra el desplegable de km al tocar afuera.
  useEffect(() => {
    if (!menuAbierto) return;
    function alClicar(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, [menuAbierto]);

  function elegirKm(km: RadioKm | "todo") {
    ubicacionLista?.onCambiar(km);
    setMenuAbierto(false);
  }

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
      {/* Ubicación en el mapa, o radio en la lista — condicional. */}
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
      {path === "/lista" && ubicacionLista && (
        <div ref={menuRef} className={styles.medioConMenu}>
          <button
            type="button"
            className={styles.circulo}
            aria-label="Elegir radio"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <IconoUbicacion />
          </button>
          {menuAbierto && (
            <div className={styles.menuKm}>
              {RADIOS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={styles.opcionKm}
                  aria-pressed={ubicacionLista.radioKm === km}
                  onClick={() => elegirKm(km)}
                >
                  {km} km
                </button>
              ))}
            </div>
          )}
        </div>
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
