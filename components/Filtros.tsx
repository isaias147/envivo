"use client";

// Botón de filtros (junto al buscador, con el nº de filtros activos) + la
// hoja que sube desde abajo con TODOS los filtros: Cuándo (incluye
// "Fechas" con Desde/Hasta), Precio, Edad y Categorías. Estilo glass de
// envivo-ui (--barra + blur 20px). Los cambios se aplican al instante;
// "Ver N eventos" solo cierra. Se cierra deslizando hacia abajo, tocando el
// velo o con Escape. Lo usan / y /lista; el estado vive en cada página y
// viaja entre las dos por la URL (queryFiltros).

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  aniosFiltro,
  contarFiltrosActivos,
  errorFechas,
  FECHAS_VACIAS,
  hoyCali,
  type FechaParcial,
  type Fechas,
  type Filtro,
  type FiltroEdad,
  type Precio,
} from "@/lib/eventos";
import FiltroTipos from "./FiltroTipos";
import styles from "./Filtros.module.css";

export type EstadoFiltros = {
  filtro: Filtro;
  fechas: Fechas;
  precio: Precio;
  edad: FiltroEdad;
  tipos: string[];
};

export const FILTROS_POR_DEFECTO: EstadoFiltros = {
  filtro: "proximos",
  fechas: FECHAS_VACIAS,
  precio: "todo",
  edad: "todo",
  tipos: [],
};

const CUANDO: { id: Filtro; etiqueta: string }[] = [
  { id: "proximos", etiqueta: "Próximamente" },
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
  { id: "fechas", etiqueta: "Fechas" },
];
const PRECIOS: { id: Precio; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "gratis", etiqueta: "Gratis" },
  { id: "cover", etiqueta: "Cover" },
];
const EDADES: { id: FiltroEdad; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "publico", etiqueta: "Todo público" },
  { id: "infantil", etiqueta: "Infantil" },
  { id: "mas_12", etiqueta: "+12" },
  { id: "mas_16", etiqueta: "+16" },
  { id: "mas_18", etiqueta: "+18" },
];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

// Cerrar deslizando: más de 80 px hacia abajo, o un gesto rápido.
const UMBRAL_PX = 80;
const UMBRAL_VELOCIDAD = 0.5; // px/ms

/** Lo que muestran los tres desplegables de un lado (Desde u Hasta). */
type Campos = { dia: string; mes: string; anio: string };
const CAMPOS_VACIOS: Campos = { dia: "", mes: "", anio: "" };

const aCampos = (f: FechaParcial | null): Campos =>
  f ? { dia: f.dia ? String(f.dia) : "", mes: String(f.mes), anio: String(f.anio) } : CAMPOS_VACIOS;
/** Solo es fecha si tiene mes y año; el día es opcional (= mes completo). */
const aFecha = (c: Campos): FechaParcial | null =>
  c.mes && c.anio
    ? { anio: Number(c.anio), mes: Number(c.mes), dia: c.dia ? Number(c.dia) : null }
    : null;

export default function Filtros({
  valor,
  onCambiar,
  total,
}: {
  valor: EstadoFiltros;
  onCambiar: (cambio: Partial<EstadoFiltros>) => void;
  /** Eventos que se ven con los filtros actuales (para "Ver N eventos"). */
  total: number;
}) {
  const [abierta, setAbierta] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  // Borrador de los desplegables de fecha: deja llenarlos en cualquier
  // orden (p. ej. el día antes que el mes) sin perder lo elegido.
  const [desde, setDesde] = useState<Campos>(CAMPOS_VACIOS);
  const [hasta, setHasta] = useState<Campos>(CAMPOS_VACIOS);
  const [arrastre, setArrastre] = useState(0);
  const botonRef = useRef<HTMLButtonElement>(null);
  const hojaRef = useRef<HTMLDivElement>(null);
  const toque = useRef<{ y: number; t: number } | null>(null);
  const idTitulo = useId();
  const activos = contarFiltrosActivos(valor);

  function abrir() {
    setDesde(aCampos(valor.fechas.desde));
    setHasta(aCampos(valor.fechas.hasta));
    setArrastre(0);
    setCerrando(false);
    setAbierta(true);
  }
  function cerrar() {
    if (!abierta || cerrando) return;
    setCerrando(true); // la animación de salida desmonta al terminar
  }
  function alTerminarAnimacion() {
    if (!cerrando) return;
    setAbierta(false);
    setCerrando(false);
    botonRef.current?.focus();
  }

  // Escape, bloqueo del scroll de fondo y foco atrapado dentro de la hoja.
  useEffect(() => {
    if (!abierta) return;
    hojaRef.current?.focus();
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCerrando(true);
      if (e.key !== "Tab" || !hojaRef.current) return;
      const focos = hojaRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select, [tabindex="0"]',
      );
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierta]);

  // ---- arrastre de la agarradera / cabecera para cerrar ----
  function alPresionar(e: React.PointerEvent) {
    toque.current = { y: e.clientY, t: e.timeStamp };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function alMover(e: React.PointerEvent) {
    if (!toque.current) return;
    setArrastre(Math.max(0, e.clientY - toque.current.y));
  }
  function alSoltar(e: React.PointerEvent) {
    if (!toque.current) return;
    const dy = e.clientY - toque.current.y;
    const velocidad = dy / Math.max(1, e.timeStamp - toque.current.t);
    toque.current = null;
    if (dy > UMBRAL_PX || velocidad > UMBRAL_VELOCIDAD) cerrar();
    else setArrastre(0);
  }

  // ---- cambios ----
  function elegirCuando(id: Filtro) {
    if (id === "fechas" && !valor.fechas.desde) {
      // Arranca en el mes actual (hora de Cali) para que se vea algo ya.
      const [anio, mes] = hoyCali().split("-");
      const inicial = { dia: "", mes: String(Number(mes)), anio };
      setDesde(inicial);
      setHasta(CAMPOS_VACIOS);
      onCambiar({ filtro: id, fechas: { desde: aFecha(inicial), hasta: null } });
      return;
    }
    onCambiar({ filtro: id });
  }
  function cambiarCampo(lado: "desde" | "hasta", campo: keyof Campos, v: string) {
    const nuevoDesde = lado === "desde" ? { ...desde, [campo]: v } : desde;
    const nuevoHasta = lado === "hasta" ? { ...hasta, [campo]: v } : hasta;
    setDesde(nuevoDesde);
    setHasta(nuevoHasta);
    onCambiar({ fechas: { desde: aFecha(nuevoDesde), hasta: aFecha(nuevoHasta) } });
  }
  function limpiar() {
    setDesde(CAMPOS_VACIOS);
    setHasta(CAMPOS_VACIOS);
    onCambiar(FILTROS_POR_DEFECTO);
  }

  const problemaFechas = valor.filtro === "fechas" ? errorFechas(valor.fechas) : null;
  const anios = aniosFiltro();

  function camposFecha(lado: "desde" | "hasta", etiqueta: string, c: Campos) {
    return (
      <div className={styles.filaFecha} role="group" aria-label={etiqueta}>
        <span className={styles.etiquetaFecha} aria-hidden="true">
          {etiqueta}
        </span>
        <select
          className={styles.select}
          value={c.dia}
          onChange={(e) => cambiarCampo(lado, "dia", e.target.value)}
          aria-label={`${etiqueta}: día`}
        >
          <option value="">Día</option>
          {DIAS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className={`${styles.select} ${styles.selectMes}`}
          value={c.mes}
          onChange={(e) => cambiarCampo(lado, "mes", e.target.value)}
          aria-label={`${etiqueta}: mes`}
        >
          <option value="">Mes</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={c.anio}
          onChange={(e) => cambiarCampo(lado, "anio", e.target.value)}
          aria-label={`${etiqueta}: año`}
        >
          <option value="">Año</option>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function segmentos<T extends string>(
    opciones: { id: T; etiqueta: string }[],
    actual: T,
    elegir: (id: T) => void,
  ) {
    return (
      <div className={styles.opciones}>
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            className={styles.opcion}
            aria-pressed={actual === o.id}
            onClick={() => elegir(o.id)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className={styles.boton}
        aria-haspopup="dialog"
        aria-expanded={abierta}
        aria-label={activos ? `Filtros, ${activos} activos` : "Filtros"}
        onClick={abrir}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        {activos > 0 && <span className={styles.globo}>{activos}</span>}
      </button>

      {abierta &&
        createPortal(
          <div
            className={`${styles.velo} ${cerrando ? styles.veloSaliendo : ""}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) cerrar();
            }}
          >
            <div
              ref={hojaRef}
              className={`${styles.hoja} ${cerrando ? styles.hojaSaliendo : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={idTitulo}
              tabIndex={-1}
              style={arrastre ? { transform: `translateY(${arrastre}px)`, transition: "none" } : undefined}
              onAnimationEnd={alTerminarAnimacion}
            >
              <div
                className={styles.cabecera}
                onPointerDown={alPresionar}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                onPointerCancel={alSoltar}
              >
                <div className={styles.asa} aria-hidden="true" />
                <h2 id={idTitulo} className={styles.titulo}>
                  Filtros
                </h2>
              </div>

              <div className={styles.cuerpo}>
                <section className={styles.seccion}>
                  <h3 className={styles.subtitulo}>Cuándo</h3>
                  {segmentos(CUANDO, valor.filtro, elegirCuando)}
                  {valor.filtro === "fechas" && (
                    <div className={styles.fechas}>
                      {camposFecha("desde", "Desde", desde)}
                      {camposFecha("hasta", "Hasta", hasta)}
                      <p className={styles.ayuda}>
                        <IconoInfo />
                        <span>
                          Deja el día vacío para ver el mes completo. Sin “Hasta”, se ve solo
                          el día o el mes de “Desde”.
                        </span>
                      </p>
                      {problemaFechas && (
                        <p className={styles.errorFechas} role="alert">
                          <IconoAlerta />
                          <span>{problemaFechas}</span>
                        </p>
                      )}
                    </div>
                  )}
                </section>

                <section className={styles.seccion}>
                  <h3 className={styles.subtitulo}>Precio</h3>
                  {segmentos(PRECIOS, valor.precio, (precio) => onCambiar({ precio }))}
                </section>

                <section className={styles.seccion}>
                  <h3 className={styles.subtitulo}>Edad</h3>
                  {segmentos(EDADES, valor.edad, (edad) => onCambiar({ edad }))}
                </section>

                <section className={styles.seccion}>
                  <h3 className={styles.subtitulo}>Categorías</h3>
                  <FiltroTipos valor={valor.tipos} onCambiar={(tipos) => onCambiar({ tipos })} envolver />
                </section>
              </div>

              <div className={styles.pie}>
                <button
                  type="button"
                  className={styles.limpiar}
                  onClick={limpiar}
                  disabled={activos === 0 && valor.filtro !== "fechas"}
                >
                  Limpiar filtros
                </button>
                <button type="button" className={styles.ver} onClick={cerrar}>
                  Ver {total} {total === 1 ? "evento" : "eventos"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function IconoInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}
function IconoAlerta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
