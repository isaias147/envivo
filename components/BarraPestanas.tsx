"use client";

// Barra de pestañas inferior fija: Inicio (/) · Listas (/lista) ·
// Seguidos (/siguiendo) · Perfil (/yo). Reemplaza la navegación de
// BarraFlotante (ya borrada: la ubicación es BotonUbicacion y el radio,
// SelectorRadio).
// Estilo de la skill envivo-ui: translúcida con blur, activa en coral.

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSeguidos } from "@/lib/siguiendo";
import styles from "./BarraPestanas.module.css";

const IconoInicio = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z" />
    <path d="M9 3v16M15 5v16" />
  </svg>
);
const IconoListas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
const IconoSeguidos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IconoPerfil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

function BarraPestanasContenido() {
  const path = usePathname();
  const sp = useSearchParams();
  const { items } = useSeguidos();
  const nuevos = items.reduce((n, i) => n + (i.nuevo ? 1 : 0), 0);

  // Inicio y Listas conservan los filtros (?t=&p=…) al pasar de una a la
  // otra; desde cualquier otra pestaña entran limpias.
  const qs = (path === "/" || path === "/lista") && sp.toString() ? `?${sp}` : "";

  const pestanas = [
    { href: "/", query: qs, etiqueta: "Inicio", Icono: IconoInicio },
    { href: "/lista", query: qs, etiqueta: "Listas", Icono: IconoListas },
    { href: "/siguiendo", query: "", etiqueta: "Seguidos", Icono: IconoSeguidos, badge: nuevos },
    { href: "/yo", query: "", etiqueta: "Perfil", Icono: IconoPerfil },
  ];

  return (
    <nav className={styles.barra} aria-label="Navegación principal">
      {pestanas.map(({ href, query, etiqueta, Icono, badge }) => {
        const activa = path === href;
        return (
          <Link
            key={href}
            href={href + query}
            className={styles.pestana}
            aria-current={activa ? "page" : undefined}
            aria-label={badge ? `${etiqueta}, ${badge} nuevos` : undefined}
          >
            <span className={styles.icono}>
              <Icono />
              {badge ? (
                <span className={styles.badge}>{badge > 9 ? "9+" : badge}</span>
              ) : null}
            </span>
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

export default function BarraPestanas() {
  return (
    <Suspense fallback={null}>
      <BarraPestanasContenido />
    </Suspense>
  );
}
