"use client";

// Fila de acciones del perfil público (/p/[slug]): "Seguir" + compartir +
// WhatsApp. Sigue el bloque `.p-acciones` del mockup
// envivo-grupo1-publico.html (slot 1).
//
// "Seguir" es PLACEHOLDER: seguir de verdad necesita una cuenta del público
// (login con Google), que es de la Fase 2 — Sesión 14 del spec. La tabla
// `seguimientos` exige `user_id = auth.uid()` por RLS, así que sin sesión no
// se puede insertar. Cuando llegue la Sesión 14, acá va: sin sesión → abrir
// el modal de Google; con sesión → insert/delete en `seguimientos` y
// refrescar el contador.

import { useState } from "react";
import styles from "./AccionesPerfil.module.css";

export default function AccionesPerfil({
  nombre,
  whatsappPublico,
}: {
  nombre: string;
  whatsappPublico: string | null;
}) {
  const [pedido, setPedido] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: nombre, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // el usuario canceló el compartir: no hacemos nada
    }
  }

  return (
    <div className={styles.caja}>
      <div className={styles.fila}>
        <button
          type="button"
          className={styles.seguir}
          aria-pressed={pedido}
          onClick={() => setPedido(true)}
        >
          {pedido ? "Te avisaremos" : "Seguir"}
        </button>

        <button
          type="button"
          className={styles.icono}
          onClick={compartir}
          aria-label="Compartir este perfil"
        >
          {copiado ? "✓" : "↗"}
        </button>

        {whatsappPublico && (
          <a
            className={styles.icono}
            href={`https://wa.me/${whatsappPublico}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escribir por WhatsApp"
          >
            💬
          </a>
        )}
      </div>

      {pedido && (
        <p className={styles.aviso}>
          Muy pronto vas a poder seguir a {nombre} con tu cuenta y recibir un
          aviso cada vez que publique algo nuevo.
        </p>
      )}
    </div>
  );
}
