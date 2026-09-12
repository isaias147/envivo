"use client";

// /mis-eventos (sin token).
//
// Dos caminos, en paralelo:
//
//  - **Cuenta con perfil de publicador** (useCuentaPublicador, Bearer de
//    Google — la cookie `envivo_publicador` ya no se activa desde que el
//    registro vive en envivo-publisher, otro dominio): trae sus eventos por
//    GET /api/publicador/eventos y muestra la lista en las cuatro secciones
//    de siempre.
//  - **Sin cuenta de Google, o sin perfil**: pantalla puente. El organizador
//    sin cuenta entra por su link personal /mis-eventos/<token> (que le
//    llega por WhatsApp). Sin ese token no hay nada que mostrar; esta ruta
//    solo explica dónde encontrarlo.
//
// La pantalla vieja /mis-eventos/[token] no se toca: sigue igual para el
// flujo por token.
//
// Pendiente menor: al pasar a "use client" se perdió el `metadata` de la
// página (título "Mis eventos · EnVivo" + robots noindex) — un Client
// Component no puede exportarlo. /yo ya vive así; no se resuelve acá.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCuentaPublicador } from "@/lib/cuentaPublicador";
import MisEventosLista, {
  type FilaMisEventos,
} from "@/components/MisEventosLista";
import styles from "./page.module.css";

export default function MisEventos() {
  const { cargandoUsuario, perfil, cargandoPerfil } = useCuentaPublicador();
  // null = todavía no llegaron (o no aplica, sin perfil); [] = llegaron vacías.
  const [filas, setFilas] = useState<FilaMisEventos[] | null>(null);
  const cargandoEventos = Boolean(perfil) && filas === null;

  useEffect(() => {
    if (!perfil) return;
    let vivo = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const r = await fetch("/api/publicador/eventos", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const j = await r.json();
        if (vivo) setFilas(Array.isArray(j.eventos) ? j.eventos : []);
      } catch {
        if (vivo) setFilas([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [perfil]);

  // Cuenta de Google o perfil todavía resolviéndose.
  if (cargandoUsuario || cargandoPerfil) {
    return (
      <div className={styles.pantalla}>
        <div className={styles.marco}>
          <div className={styles.marca}>
            En<i>Vivo</i>
          </div>
          <div className={styles.ruta}>envivo.app/mis-eventos</div>
          <p className={styles.bajada}>Cargando…</p>
        </div>
      </div>
    );
  }

  // ---------- cuenta con perfil: eventos por perfil_id ----------
  if (perfil) {
    return (
      <div className={styles.pantalla}>
        <div className={styles.marco}>
          <div className={styles.marca}>
            En<i>Vivo</i>
          </div>
          <div className={styles.ruta}>envivo.app/mis-eventos</div>

          <h1 className={styles.tit}>Tus eventos</h1>
          <p className={styles.bajada}>
            Todo lo que has publicado
            {perfil.nombre ? (
              <>
                {" "}
                como <b className={styles.nombre}>{perfil.nombre}</b>
              </>
            ) : null}
            .
          </p>

          {cargandoEventos ? (
            <p className={styles.bajada}>Cargando…</p>
          ) : (
            <MisEventosLista
              filas={filas ?? []}
              mensajeVacio="Todavía no has publicado nada. En cuanto envíes tu primer evento y lo revisemos, aparece aquí."
            />
          )}

          <Link href="/publicar/nuevo" className={styles.enviar}>
            Publicar otro evento
          </Link>
          <p className={styles.pie}>
            ¿Necesitas cambiar algo? Escríbenos por WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  // ---------- sin cuenta de Google, o sin perfil: pantalla puente ----------
  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/mis-eventos</div>

        <h1 className={styles.tit}>Abre tu link personal</h1>
        <p className={styles.bajada}>
          No hay registro ni contraseña. Cuando aprobamos tu primer evento te
          enviamos por WhatsApp un link como{" "}
          <span className={styles.codigo}>envivo.app/mis-eventos/xK9p…</span>.
          Ábrelo desde ese mensaje: ahí está todo lo que has publicado.
        </p>
        <p className={styles.bajada}>
          ¿Aún no publicas nada o perdiste tu link? Escríbenos por WhatsApp y te
          lo reenviamos.
        </p>

        <Link href="/publicar/nuevo" className={styles.enviar}>
          Publicar un evento
        </Link>
        <Link href="/publicar" className={styles.volver}>
          Volver al mapa
        </Link>
      </div>
    </div>
  );
}
