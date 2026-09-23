"use client";

// Botón flotante "volver a mi ubicación" (skill envivo-ui: cian = ubicación).
// Abajo a la derecha, encima de la barra de pestañas, en / y /lista.
//
// Al tocarlo pide la posición real en ese momento y se la pasa a la página
// (`onUbicacion`): el mapa pone ahí el punto y centra la cámara; la lista
// pone ahí el punto y recalcula distancias. Estilo Apple Maps: flecha
// rellena si el punto ya está en la posición real (`activo`), en contorno si
// el usuario lo movió. Si falla (permiso negado u otra causa), muestra un
// aviso breve con ícono + texto.

import { useEffect, useState } from "react";
import styles from "./BotonUbicacion.module.css";

type Coords = { lat: number; lng: number };
type Aviso = "bloqueada" | "fallo" | null;

const DURACION_AVISO_MS = 5000;

const TEXTO_AVISO: Record<Exclude<Aviso, null>, string> = {
  bloqueada:
    "Tu ubicación está bloqueada. Actívala en los ajustes del navegador para este sitio (ícono del candado → Ubicación) y vuelve a tocar.",
  fallo: "No pudimos encontrar tu ubicación. Intenta de nuevo.",
};

// Flecha de ubicación estilo iOS (location / location.fill).
function Flecha({ rellena }: { rellena: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.flecha}>
      <path
        d="M20.2 3.8 4.3 10.4c-.8.3-.7 1.4.1 1.6l6.3 1.6 1.6 6.3c.2.8 1.3.9 1.6.1z"
        fill={rellena ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Ubicación tachada, para el aviso.
function FlechaTachada() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.iconoAviso}>
      <path
        d="M20.2 3.8 4.3 10.4c-.8.3-.7 1.4.1 1.6l6.3 1.6 1.6 6.3c.2.8 1.3.9 1.6.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function BotonUbicacion({
  activo,
  onUbicacion,
  alturaExtra = 0,
}: {
  /** El punto de referencia ya está en la posición real. */
  activo: boolean;
  onUbicacion: (c: Coords) => void;
  /** Alto (px) de la ficha abierta en el mapa: sube el botón esa medida. */
  alturaExtra?: number;
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  function pedirUbicacion() {
    if (buscando) return;
    if (!("geolocation" in navigator)) {
      setAviso("fallo");
      return;
    }
    setBuscando(true);
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscando(false);
        onUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setBuscando(false);
        setAviso(err.code === err.PERMISSION_DENIED ? "bloqueada" : "fallo");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div
      className={styles.contenedor}
      style={
        alturaExtra
          ? {
              bottom: `calc(env(safe-area-inset-bottom) + var(--barra-inf) + 18px + ${alturaExtra + 12}px)`,
            }
          : undefined
      }
    >
      <div role="status" aria-live="polite" className={styles.vivo}>
        {aviso && (
          <p className={styles.aviso}>
            <FlechaTachada />
            <span>{TEXTO_AVISO[aviso]}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        className={styles.boton}
        aria-label={activo ? "Estás en tu ubicación. Recentrar" : "Volver a mi ubicación"}
        aria-busy={buscando}
        onClick={pedirUbicacion}
      >
        <Flecha rellena={activo} />
      </button>
    </div>
  );
}
