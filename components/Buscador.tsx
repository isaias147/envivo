"use client";

// El buscador de eventos y lugares. Cápsula de cristal fija con input y
// resultados agrupados debajo. No decide qué hacer con lo elegido: eso lo
// resuelve el padre por `onSeleccionar` (el mapa centra y abre la ficha; la
// lista redirige al mapa).

import { useEffect, useRef, useState } from "react";
import { buscarEnvivo, type ResultadoBusqueda } from "@/lib/busqueda";
import styles from "./Buscador.module.css";

const MIN_CARACTERES = 2;
const MAX_POR_GRUPO = 5;
const DEBOUNCE_MS = 300;

export default function Buscador({
  onSeleccionar,
}: {
  onSeleccionar: (resultado: ResultadoBusqueda) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar con debounce; menos de 2 caracteres no dispara nada (el
  // vaciado inmediato del resultado, al borrar, lo hace `alEscribir`).
  useEffect(() => {
    const termino = texto.trim();
    if (termino.length < MIN_CARACTERES) return;
    let vivo = true;
    const id = setTimeout(async () => {
      try {
        const r = await buscarEnvivo(termino);
        if (vivo) setResultados(r);
      } catch {
        if (vivo) setResultados([]);
      } finally {
        if (vivo) setCargando(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [texto]);

  function alEscribir(v: string) {
    setTexto(v);
    if (v.trim().length < MIN_CARACTERES) {
      setResultados([]);
      setCargando(false);
    } else {
      setCargando(true);
    }
  }

  function elegir(resultado: ResultadoBusqueda) {
    onSeleccionar(resultado);
    setTexto("");
    setResultados([]);
  }

  function limpiar() {
    setTexto("");
    setResultados([]);
    inputRef.current?.focus();
  }

  const eventos = resultados
    .filter((r) => r.tipo === "evento")
    .slice(0, MAX_POR_GRUPO);
  // "Ubicaciones" junta perfiles (lugares reales) y ubicaciones (el
  // promedio de una ciudad que matcheó por el nombre): para quien busca,
  // ambos son "adónde ir", solo cambia si al llegar hay una ficha o no.
  const ubicaciones = resultados
    .filter((r) => r.tipo === "perfil" || r.tipo === "ubicacion")
    .slice(0, MAX_POR_GRUPO);
  const sinResultados =
    !cargando && texto.trim().length >= MIN_CARACTERES && resultados.length === 0;

  return (
    <div className={styles.raiz}>
      <div className={styles.campo}>
        <svg
          className={styles.lupaChica}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          placeholder="Busca aquí"
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") limpiar();
          }}
          className={styles.input}
        />
        {texto && (
          <button
            type="button"
            className={styles.cerrar}
            aria-label="Borrar búsqueda"
            onClick={limpiar}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {(texto.trim().length >= MIN_CARACTERES) && (
        <div className={styles.dropdown}>
          {cargando && <p className={styles.mensaje}>Buscando…</p>}
          {sinResultados && (
            <p className={styles.mensaje}>Nada por aquí con ese nombre.</p>
          )}
          {ubicaciones.length > 0 && (
            <div className={styles.grupo}>
              <p className={styles.etiquetaGrupo}>Ubicaciones</p>
              {ubicaciones.map((r) => (
                <FilaResultado key={r.id} resultado={r} onElegir={elegir} />
              ))}
            </div>
          )}
          {eventos.length > 0 && (
            <div className={styles.grupo}>
              <p className={styles.etiquetaGrupo}>Eventos</p>
              {eventos.map((r) => (
                <FilaResultado key={r.id} resultado={r} onElegir={elegir} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilaResultado({
  resultado,
  onElegir,
}: {
  resultado: ResultadoBusqueda;
  onElegir: (r: ResultadoBusqueda) => void;
}) {
  return (
    <button
      type="button"
      className={styles.fila}
      onClick={() => onElegir(resultado)}
    >
      <div
        className={`${styles.miniFila} ${resultado.tipo === "perfil" ? styles.miniRedonda : ""}`}
      >
        {resultado.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resultado.imagen_url} alt="" />
        )}
      </div>
      <div className={styles.textoFila}>
        <p className={styles.tituloFila}>{resultado.titulo}</p>
        {resultado.subtitulo && (
          <p className={styles.subtituloFila}>{resultado.subtitulo}</p>
        )}
      </div>
    </button>
  );
}
