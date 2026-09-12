"use client";

// Pantalla · /perfil — vista privada del dueño de un perfil.
//
// Sesión 13:
//  - paso 5: el número REAL de seguidores, siempre (aunque sea < 25).
//  - paso 7: editar nombre (libre) e Instagram + WhatsApp público (con
//    candado de 30 días desde `perfiles.ultimo_cambio_contacto`).
//
// La sesión ya no se resuelve por la cookie `envivo_publicador`
// (`leerSesionPublicador`): esa cookie no se activa para cuentas
// registradas en envivo-publisher (otro dominio). Ahora usa
// useCuentaPublicador() — Bearer del access_token de Google, igual que
// /publicar/nuevo y /yo — para saber si hay perfil, y GET
// /api/publicador/perfil (mismo Bearer) para traer sus datos completos.
// Sin perfil → a envivo-publisher (con window.location.href, cross-origin;
// /registro ya no existe en este repo). Toda escritura sigue pasando por
// `/api/publicador/perfil/editar` (service_role, revalida el candado; ese
// endpoint ya acepta el mismo Bearer, con la cookie como respaldo).
//
// Pendiente menor: al pasar a "use client" se perdió el `metadata` de la
// página (título "Tu perfil · EnVivo" + robots noindex) — un Client
// Component no puede exportarlo. /yo ya vive así; no se resuelve acá.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCuentaPublicador } from "@/lib/cuentaPublicador";
import { normalizarWhatsapp } from "@/lib/eventos";
import { candadoContacto } from "@/lib/candadoContacto";
import EditarPerfilForm from "@/components/EditarPerfilForm";
import styles from "./page.module.css";

const SEGUIDORES_MIN_PUBLICO = 25;

const TIPO_ETIQUETA: Record<string, string> = {
  local: "Local",
  organizador: "Organizador",
  artista: "Artista",
};

type PerfilCompleto = {
  slug: string | null;
  nombre: string | null;
  tipo: string | null;
  instagram: string | null;
  whatsappPublico: string | null;
  ultimoCambioContacto: string | null;
  seguidores: number;
};

export default function MiPerfil() {
  const {
    cargandoUsuario,
    perfil: perfilCuenta,
    cargandoPerfil,
  } = useCuentaPublicador();
  // null = todavía no llegó (o no aplica, sin perfil de cuenta).
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [errorDatos, setErrorDatos] = useState(false);

  useEffect(() => {
    if (cargandoUsuario || cargandoPerfil) return;
    if (!perfilCuenta) {
      window.location.href =
        "https://envivo-publisher.imsoluciones.com/registro";
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const r = await fetch("/api/publicador/perfil", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const j = await r.json();
        if (!vivo) return;
        if (r.ok) setPerfil(j);
        else setErrorDatos(true);
      } catch {
        if (vivo) setErrorDatos(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cargandoUsuario, cargandoPerfil, perfilCuenta]);

  if (
    cargandoUsuario ||
    cargandoPerfil ||
    !perfilCuenta ||
    (!perfil && !errorDatos)
  ) {
    return (
      <div className={styles.pantalla}>
        <div className={styles.marco}>
          <div className={styles.marca}>
            En<i>Vivo</i>
          </div>
          <div className={styles.ruta}>envivo.app/perfil</div>
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className={styles.pantalla}>
        <div className={styles.marco}>
          <div className={styles.marca}>
            En<i>Vivo</i>
          </div>
          <div className={styles.ruta}>envivo.app/perfil</div>
          <p>No pudimos cargar tu perfil. Intenta de nuevo más tarde.</p>
        </div>
      </div>
    );
  }

  const nombre = perfil.nombre ?? perfilCuenta.nombre ?? "";
  const etiqueta = perfil.tipo ? TIPO_ETIQUETA[perfil.tipo] ?? null : null;
  const { bloqueado, desbloqueaEn } = candadoContacto(
    perfil.ultimoCambioContacto,
  );

  const seguidores = perfil.seguidores;
  const publico = seguidores >= SEGUIDORES_MIN_PUBLICO;
  const faltan = SEGUIDORES_MIN_PUBLICO - seguidores;

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/perfil</div>

        <h1 className={styles.tit}>Tu perfil</h1>

        <EditarPerfilForm
          nombre={nombre}
          instagram={perfil.instagram ?? ""}
          whatsappPublico={normalizarWhatsapp(perfil.whatsappPublico)}
          tipoEtiqueta={etiqueta}
          bloqueado={bloqueado}
          desbloqueaEn={desbloqueaEn}
        />

        <div className={styles.stat}>
          <div className={styles.numero}>
            {seguidores.toLocaleString("es-CO")}
          </div>
          <div className={styles.etiqueta}>
            {seguidores === 1 ? "seguidor" : "seguidores"}
          </div>
        </div>
        <p className={styles.nota}>
          {publico
            ? "Tu perfil público muestra este número."
            : `Este número es privado hasta llegar a ${SEGUIDORES_MIN_PUBLICO}. ` +
              `En tu perfil público todavía no aparece (faltan ${faltan}).`}
        </p>

        <nav className={styles.accesos}>
          {perfil.slug && (
            <Link className={styles.acceso} href={`/p/${perfil.slug}`}>
              <span>Ver mi perfil público</span>
              <span className={styles.flecha}>→</span>
            </Link>
          )}
          <Link className={styles.acceso} href="/panel">
            <span>Volver al panel</span>
            <span className={styles.flecha}>→</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
