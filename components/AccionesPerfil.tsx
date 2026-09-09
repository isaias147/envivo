"use client";

// Fila de acciones del perfil público (/p/[slug]): "Seguir" + compartir +
// WhatsApp. Sigue el bloque `.p-acciones` del mockup
// envivo-grupo1-publico.html (slot 1).
//
// "Seguir" es real desde la Sesión 14, paso 2 (ver components/BotonSeguir):
// sin sesión abre el modal de Google, con sesión hace insert/delete en
// `seguimientos`.

import { useState } from "react";
import BotonSeguir from "@/components/BotonSeguir";
import styles from "./AccionesPerfil.module.css";

export default function AccionesPerfil({
  perfilId,
  nombre,
  whatsappPublico,
}: {
  perfilId: string;
  nombre: string;
  whatsappPublico: string | null;
}) {
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
        <div className={styles.seguirSlot}>
          <BotonSeguir perfilId={perfilId} nombre={nombre} />
        </div>

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
    </div>
  );
}
