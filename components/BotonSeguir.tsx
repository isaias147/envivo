"use client";

// Botón "Seguir" / "Siguiendo" del usuario final (Sesión 14, paso 2).
//
// - Sin sesión de usuario final → abre ModalEntrarConGoogle (paso 1). Deja
//   marcado el perfil para completar el follow al volver del login.
// - Con sesión → POST /api/seguir (seguir/dejar). Optimista + revierte si
//   falla. Al terminar, router.refresh() para que el contador de /p/[slug]
//   (Server Component) se repinte.
//
// Se usa en /p/[slug] (dentro de AccionesPerfil) y en /evento/[id] (tarjeta
// "Publicado por"): en ambos casos sigue al PERFIL, nunca al evento.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  marcarSeguirPendiente,
  tomarSeguirPendiente,
  useUsuario,
} from "@/lib/authUsuario";
import ModalEntrarConGoogle from "@/components/ModalEntrarConGoogle";
import styles from "./BotonSeguir.module.css";

export default function BotonSeguir({
  perfilId,
  nombre,
  className,
}: {
  perfilId: string;
  nombre: string;
  className?: string;
}) {
  const router = useRouter();
  const { usuario, cargando } = useUsuario();
  const [siguiendo, setSiguiendo] = useState<boolean | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  const enviar = useCallback(
    async (accion: "seguir" | "dejar"): Promise<boolean> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return false;
      try {
        const r = await fetch("/api/seguir", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ perfilId, accion }),
        });
        return r.ok;
      } catch {
        return false;
      }
    },
    [perfilId],
  );

  // Al entrar (o volver del login): ¿ya sigue a este perfil? Y si venía de
  // logearse para seguir justo a este, completarlo.
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    (async () => {
      setSiguiendo(null);
      const { data } = await supabase
        .from("seguimientos")
        .select("perfil_id")
        .eq("user_id", usuario.id)
        .eq("perfil_id", perfilId)
        .maybeSingle();
      if (!vivo) return;

      let sig = Boolean(data);
      if (!sig && tomarSeguirPendiente() === perfilId) {
        if (await enviar("seguir")) {
          sig = true;
          router.refresh();
        }
      }
      if (vivo) setSiguiendo(sig);
    })();
    return () => {
      vivo = false;
    };
  }, [usuario, perfilId, enviar, router]);

  async function alTocar() {
    if (trabajando || cargando) return;
    if (!usuario) {
      marcarSeguirPendiente(perfilId);
      setModalAbierto(true);
      return;
    }
    const accion = siguiendo ? "dejar" : "seguir";
    setTrabajando(true);
    setSiguiendo(accion === "seguir"); // optimista
    const ok = await enviar(accion);
    if (!ok) {
      setSiguiendo(accion !== "seguir"); // revertir
    } else {
      router.refresh();
    }
    setTrabajando(false);
  }

  const yaSigue = Boolean(usuario) && siguiendo === true;
  const etiqueta = !usuario
    ? "Seguir"
    : siguiendo === null
      ? "…"
      : yaSigue
        ? "Siguiendo"
        : "Seguir";

  return (
    <>
      <button
        type="button"
        className={`${styles.boton} ${className ?? ""}`}
        aria-pressed={yaSigue}
        disabled={trabajando}
        onClick={alTocar}
      >
        {etiqueta}
      </button>

      <ModalEntrarConGoogle
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={`Entra para seguir a ${nombre}`}
        descripcion="Vas a ver sus próximos eventos en «Siguiendo». No publicas nada ni es obligatorio para usar el mapa."
      />
    </>
  );
}
