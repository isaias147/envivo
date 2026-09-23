"use client";

// Botón de radio de búsqueda (skill envivo-ui: cian = ubicación). Muestra el
// radio actual; al tocarlo abre un deslizador de RADIO_MIN_KM a RADIO_MAX_KM
// en pasos de RADIO_PASO_KM. Cada movimiento llama `onCambiar` en vivo (el
// círculo del mapa se redibuja al instante). Se cierra al tocar fuera o con
// Escape. Lo usan / y /lista con el mismo valor (?km= en la URL).

import { useEffect, useId, useRef, useState } from "react";
import {
  RADIO_MAX_KM,
  RADIO_MIN_KM,
  RADIO_PASO_KM,
  formatoKm,
  type RadioKm,
} from "@/lib/eventos";
import styles from "./SelectorRadio.module.css";

export default function SelectorRadio({
  radioKm,
  onCambiar,
}: {
  radioKm: RadioKm;
  onCambiar: (km: RadioKm) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  useEffect(() => {
    if (!abierto) return;
    function afuera(e: PointerEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div ref={raizRef} className={styles.raiz}>
      <button
        type="button"
        className={styles.boton}
        aria-expanded={abierto}
        aria-controls={idPanel}
        aria-label={`Radio de búsqueda: ${formatoKm(radioKm)}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
        {formatoKm(radioKm)}
      </button>

      {abierto && (
        <div id={idPanel} className={styles.panel}>
          <input
            type="range"
            className={styles.deslizador}
            min={RADIO_MIN_KM}
            max={RADIO_MAX_KM}
            step={RADIO_PASO_KM}
            value={radioKm}
            onChange={(e) => onCambiar(Number(e.target.value))}
            aria-label="Radio de búsqueda"
            aria-valuetext={formatoKm(radioKm)}
          />
          <div className={styles.extremos} aria-hidden="true">
            <span>{formatoKm(RADIO_MIN_KM)}</span>
            <span>{formatoKm(RADIO_MAX_KM)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
