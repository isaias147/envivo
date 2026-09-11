"use client";

// Hook cliente: ¿la cuenta de Google logueada (usuario final, Supabase Auth)
// tiene además un perfil de publicador?
//
// Le pega a GET /api/publicador/sesion mandando el access_token de Google
// como Bearer — esa ruta, cuando recibe esa cabecera, resuelve el perfil por
// `perfiles.user_id` en vez de por la cookie `envivo_publicador`. La usan
// /yo (para mostrar "Mis eventos"/"Mi perfil" o "Quiero publicar") y /
// (mapa público, para el botón "Publicar evento").

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/lib/authUsuario";
import { esTipoPerfil, type TipoPerfil } from "@/lib/tiposPerfil";

export type PerfilPublicador = {
  perfilId: string;
  nombre: string | null;
  tipo: TipoPerfil;
};

export function useCuentaPublicador(): {
  usuario: ReturnType<typeof useUsuario>["usuario"];
  cargandoUsuario: boolean;
  perfil: PerfilPublicador | null;
  cargandoPerfil: boolean;
} {
  const { usuario, cargando: cargandoUsuario } = useUsuario();
  const [perfil, setPerfil] = useState<PerfilPublicador | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const consultadoParaId = useRef<string | null>(null);

  useEffect(() => {
    if (cargandoUsuario || !usuario) return;
    if (consultadoParaId.current === usuario.id) return;
    consultadoParaId.current = usuario.id;

    let vivo = true;
    setCargandoPerfil(true);
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const r = await fetch("/api/publicador/sesion", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const j = await r.json();
        if (!vivo) return;
        setPerfil(
          j.activa && j.perfilId
            ? {
                perfilId: j.perfilId,
                nombre: j.nombre ?? null,
                tipo: esTipoPerfil(j.tipo) ? j.tipo : "local",
              }
            : null,
        );
      } catch {
        if (vivo) setPerfil(null);
      } finally {
        if (vivo) setCargandoPerfil(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usuario, cargandoUsuario]);

  // Sin cuenta de Google, el perfil no aplica: se enmascara acá en vez de
  // resetearlo con un setState síncrono dentro del efecto de arriba.
  return {
    usuario,
    cargandoUsuario,
    perfil: usuario ? perfil : null,
    cargandoPerfil: usuario ? cargandoPerfil : false,
  };
}
