"use client";

// Columna de 3 círculos flotantes (FAB), abajo a la derecha. Reemplaza la
// barra inferior de tabs (BarraInferior.tsx, mismo patrón: usePathname,
// useSearchParams, Suspense wrapper).
//
// El círculo del medio cambia de función según la página que lo monta (ver
// Props): en el mapa vuelve a la ubicación real; en la lista abre un
// desplegable para elegir el radio. Si la página no pasa la prop que le
// corresponde, ese círculo no se renderiza y la columna queda de 2.

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCuentaPublicador } from "@/lib/cuentaPublicador";
import { RADIOS_KM, type RadioKm } from "@/lib/eventos";
import { useSeguidos } from "@/lib/siguiendo";
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

const IconoMapa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z" />
    <path d="M9 3v16M15 5v16" />
  </svg>
);
const IconoLista = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
const IconoCampana = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IconoUbicacion = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);
const IconoPublicar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

function BarraFlotanteContenido({
  ubicacionMapa,
  ubicacionLista,
  alturaExtra = 0,
}: Props) {
  const path = usePathname();
  const sp = useSearchParams();
  const { perfil: perfilPublicador } = useCuentaPublicador();
  const { items } = useSeguidos();
  const nuevos = items.reduce((n, i) => n + (i.nuevo ? 1 : 0), 0);
  const qs = sp.toString() ? `?${sp.toString()}` : "";

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

  // Círculo de abajo: alterna Mapa/Lista (conserva ?t=&p= al cambiar de
  // vista; en cualquier otra ruta cae siempre al mapa, sin filtros).
  let toggleHref = "/";
  let toggleLabel = "Ver mapa";
  let ToggleIcono = IconoMapa;
  if (path === "/") {
    toggleHref = `/lista${qs}`;
    toggleLabel = "Ver lista";
    ToggleIcono = IconoLista;
  } else if (path === "/lista") {
    toggleHref = `/${qs}`;
    toggleLabel = "Ver mapa";
    ToggleIcono = IconoMapa;
  }

  function elegirKm(km: RadioKm | "todo") {
    ubicacionLista?.onCambiar(km);
    setMenuAbierto(false);
  }

  return (
    <nav
      className={styles.columna}
      aria-label="Navegación flotante"
      style={{
        bottom: alturaExtra
          ? `calc(env(safe-area-inset-bottom) + 168px + ${alturaExtra}px)`
          : undefined,
      }}
    >
      {/* Más arriba de todos: publicar (solo con perfil de publicador). */}
      {perfilPublicador && (
        <Link
          href="/publicar/nuevo"
          className={styles.circulo}
          aria-label="Publicar evento"
        >
          <IconoPublicar />
        </Link>
      )}

      {/* Arriba: Siguiendo */}
      <Link
        href="/siguiendo"
        className={`${styles.circulo} ${path === "/siguiendo" ? styles.activo : ""}`}
        aria-label="Siguiendo"
        aria-current={path === "/siguiendo" ? "page" : undefined}
      >
        <IconoCampana />
        {nuevos > 0 && (
          <span className={styles.badge}>{nuevos > 9 ? "9+" : nuevos}</span>
        )}
      </Link>

      {/* Medio: ubicación en el mapa, o radio en la lista — condicional. */}
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

      {/* Abajo: alterna Mapa/Lista */}
      <Link href={toggleHref} className={styles.circulo} aria-label={toggleLabel}>
        <ToggleIcono />
      </Link>
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
