"use client";

// Pantalla · /siguiendo — a quién sigue el usuario final (Sesión 14, paso 3).
// Sigue los slots 3 y 3b de envivo-grupo1-publico.html.
//
// La lógica de traer seguidos + el flag "Nuevo" vive en lib/siguiendo.ts
// (compartida con la barra inferior). Acá se marca la visita
// (`ultima_visita_siguiendo`) al terminar de cargar.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { horaCali } from "@/lib/eventos";
import { useSeguidos, type EventoSeguido } from "@/lib/siguiendo";
import ModalEntrarConGoogle from "@/components/ModalEntrarConGoogle";
import BarraInferior from "@/components/BarraInferior";
import EnlaceCuenta from "@/components/EnlaceCuenta";
import styles from "./page.module.css";

const ICONO_TIPO: Record<string, string> = {
  local: "🏠",
  organizador: "📋",
  artista: "🎤",
};

/** "Viernes 9:00pm — Jam de salsa" */
function lineaEvento(ev: EventoSeguido): string {
  const dia = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
  }).format(new Date(ev.starts_at));
  const { hhmm, periodo } = horaCali(ev.starts_at);
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${diaCap} ${hhmm}${periodo} — ${ev.title}`;
}

export default function Siguiendo() {
  const { items, estado } = useSeguidos();
  const [modalAbierto, setModalAbierto] = useState(false);
  const marcado = useRef(false);

  // Sello de "visto ahora" para el badge de la próxima vez. Una sola vez.
  useEffect(() => {
    if (estado === "listo" && !marcado.current) {
      marcado.current = true;
      supabase.auth
        .updateUser({
          data: { ultima_visita_siguiendo: new Date().toISOString() },
        })
        .catch(() => {});
    }
  }, [estado]);

  return (
    <div className={styles.pantalla}>
      <header className={styles.top}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <EnlaceCuenta />
      </header>

      <h1 className={styles.titulo}>Siguiendo</h1>

      {estado === "cargando" ? (
        <p className={styles.info}>Cargando…</p>
      ) : estado === "sin-sesion" ? (
        <div className={styles.vacio}>
          <p>
            Entrá con tu cuenta para ver acá a los locales, organizadores y
            artistas que seguís y su próximo evento.
          </p>
          <button
            type="button"
            className={styles.entrar}
            onClick={() => setModalAbierto(true)}
          >
            Entrar con Google
          </button>
        </div>
      ) : estado === "error" ? (
        <p className={styles.info}>
          No se pudo cargar. Recargá la página e intentá de nuevo.
        </p>
      ) : items.length === 0 ? (
        <div className={styles.vacio}>
          <p>
            Todavía no seguís a nadie. Tocá “Seguir” en cualquier perfil o
            evento y aparece acá.
          </p>
        </div>
      ) : (
        <ul className={styles.lista}>
          {items.map(({ perfil, evento, nuevo }) => (
            <li key={perfil.id}>
              <Link
                href={perfil.slug ? `/p/${perfil.slug}` : "#"}
                className={styles.tarjeta}
              >
                <span className={styles.avatar}>
                  {perfil.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={perfil.imagen_url} alt="" />
                  ) : (
                    (perfil.tipo && ICONO_TIPO[perfil.tipo]) || "•"
                  )}
                </span>
                <span className={styles.datos}>
                  <span className={styles.nombre}>
                    {perfil.nombre ?? "Perfil"}
                  </span>
                  <span className={styles.prox}>
                    {evento ? lineaEvento(evento) : "Sin eventos próximos"}
                  </span>
                </span>
                {nuevo && <span className={styles.nuevo}>Nuevo</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ModalEntrarConGoogle
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Entra a EnVivo"
        descripcion="Con tu cuenta ves acá a los locales, organizadores y artistas que seguís y recibís un aviso cuando publican algo nuevo."
      />

      <BarraInferior />
    </div>
  );
}
