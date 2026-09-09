"use client";

// Barra inferior de tabs: Mapa · Lista · Siguiendo (Sesión 14, paso 5).
// Sigue la `.tabbar` de envivo-grupo1-publico.html.
//
// Se renderiza en /, /lista, /siguiendo y /yo (en /yo no hay tab activo).
// El badge del tab Siguiendo = cantidad de perfiles seguidos cuyo próximo
// evento está marcado "Nuevo" (misma lógica que /siguiendo, vía useSeguidos).
//
// Mapa y Lista conservan los filtros actuales (`?t=&p=`); Siguiendo no.

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSeguidos } from "@/lib/siguiendo";
import styles from "./BarraInferior.module.css";

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
const IconoCorazon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.8 8.6a5 5 0 0 0-8.8-3 5 5 0 0 0-8.8 3c0 4.6 6 9 8.8 11.2 2.8-2.2 8.8-6.6 8.8-11.2z" />
  </svg>
);

function BarraInferiorContenido() {
  const path = usePathname();
  const sp = useSearchParams();
  const { items } = useSeguidos();
  const nuevos = items.reduce((n, i) => n + (i.nuevo ? 1 : 0), 0);
  const qs = sp.toString() ? `?${sp.toString()}` : "";

  const tabs = [
    { base: "/", href: `/${qs}`, label: "Mapa", Icono: IconoMapa, badge: 0 },
    { base: "/lista", href: `/lista${qs}`, label: "Lista", Icono: IconoLista, badge: 0 },
    { base: "/siguiendo", href: "/siguiendo", label: "Siguiendo", Icono: IconoCorazon, badge: nuevos },
  ];

  return (
    <nav className={styles.barra} aria-label="Navegación principal">
      {tabs.map(({ base, href, label, Icono, badge }) => {
        const activo = base === "/" ? path === "/" : path.startsWith(base);
        return (
          <Link
            key={base}
            href={href}
            className={`${styles.tab} ${activo ? styles.activo : ""}`}
            aria-current={activo ? "page" : undefined}
          >
            <span className={styles.icono}>
              <Icono />
              {badge > 0 && (
                <span className={styles.badge}>{badge > 9 ? "9+" : badge}</span>
              )}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function BarraInferior() {
  return (
    <Suspense fallback={null}>
      <BarraInferiorContenido />
    </Suspense>
  );
}
