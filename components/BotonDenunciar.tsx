"use client";

// Botón "Reportar un problema" del detalle de evento (Sesión 18 — moderación).
//
// - Sin sesión de usuario final → abre ModalEntrarConGoogle (el mismo del
//   botón Seguir). Denunciar exige cuenta para evitar denuncias en masa.
// - Con sesión → hoja inferior con los 5 motivos → POST /api/eventos/denunciar
//   con el access_token en Authorization: Bearer.
//
// El botón es discreto a propósito: va al final del detalle, en texto tenue.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/lib/authUsuario";
import ModalEntrarConGoogle from "@/components/ModalEntrarConGoogle";
import styles from "./BotonDenunciar.module.css";

const MOTIVOS: { valor: string; etiqueta: string }[] = [
  { valor: "no_existe", etiqueta: "El evento no existe" },
  { valor: "info_falsa", etiqueta: "La información es falsa" },
  { valor: "lugar_equivocado", etiqueta: "El lugar está equivocado" },
  { valor: "inapropiado", etiqueta: "Contenido inapropiado" },
  { valor: "otro", etiqueta: "Otro" },
];

type Fase = "idle" | "enviando" | "listo" | "error";

export default function BotonDenunciar({ eventId }: { eventId: string }) {
  const { usuario, cargando } = useUsuario();
  const [modalGoogle, setModalGoogle] = useState(false);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("idle");

  useEffect(() => {
    if (!hojaAbierta) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarHoja();
    };
    document.addEventListener("keydown", alTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [hojaAbierta]);

  function cerrarHoja() {
    setHojaAbierta(false);
    setMotivo(null);
    setFase("idle");
  }

  function alTocar() {
    if (cargando) return;
    if (!usuario) {
      setModalGoogle(true);
      return;
    }
    setHojaAbierta(true);
  }

  async function enviar() {
    if (!motivo || fase === "enviando") return;
    setFase("enviando");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setFase("error");
        return;
      }
      const r = await fetch("/api/eventos/denunciar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId, motivo }),
      });
      setFase(r.ok ? "listo" : "error");
    } catch {
      setFase("error");
    }
  }

  return (
    <>
      <button type="button" className={styles.disparador} onClick={alTocar}>
        Reportar un problema
      </button>

      <ModalEntrarConGoogle
        abierto={modalGoogle}
        onCerrar={() => setModalGoogle(false)}
        titulo="Entra para reportar"
        descripcion="Con tu cuenta puedes avisarnos si un evento no existe o tiene datos falsos. No publicas nada."
      />

      {hojaAbierta &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.velo}
            role="dialog"
            aria-modal="true"
            aria-label="Reportar un problema con el evento"
            onClick={(e) => {
              if (e.target === e.currentTarget) cerrarHoja();
            }}
          >
            <div className={styles.hoja}>
              <div className={styles.asa} aria-hidden="true" />

              {fase === "listo" ? (
                <>
                  <h2 className={styles.titulo}>Gracias por avisar</h2>
                  <p className={styles.texto}>
                    Lo revisamos. Si varias personas reportan lo mismo, el
                    evento se baja del mapa.
                  </p>
                  <button
                    type="button"
                    className={styles.cerrar}
                    onClick={cerrarHoja}
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <>
                  <h2 className={styles.titulo}>¿Qué pasa con este evento?</h2>
                  <div className={styles.opciones}>
                    {MOTIVOS.map((m) => (
                      <label key={m.valor} className={styles.opcion}>
                        <input
                          type="radio"
                          name="motivo-denuncia"
                          value={m.valor}
                          checked={motivo === m.valor}
                          onChange={() => setMotivo(m.valor)}
                        />
                        <span>{m.etiqueta}</span>
                      </label>
                    ))}
                  </div>

                  {fase === "error" && (
                    <p className={styles.error}>
                      No se pudo enviar. Prueba de nuevo.
                    </p>
                  )}

                  <button
                    type="button"
                    className={styles.enviar}
                    disabled={!motivo || fase === "enviando"}
                    onClick={enviar}
                  >
                    {fase === "enviando" ? "Enviando…" : "Enviar reporte"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelar}
                    onClick={cerrarHoja}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
