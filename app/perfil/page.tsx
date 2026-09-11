// Pantalla · /perfil — vista privada del dueño de un perfil.
//
// Sesión 13:
//  - paso 5: el número REAL de seguidores, siempre (aunque sea < 25).
//  - paso 7: editar nombre (libre) e Instagram + WhatsApp público (con
//    candado de 30 días desde `perfiles.ultimo_cambio_contacto`).
//
// Privacidad: la ruta no recibe slug ni id. El perfil consultado es siempre
// el de la cookie `envivo_publicador` (`sesion.perfilId`), así que solo se
// ve el propio. Sin sesión → /registro. Toda escritura pasa por
// `/api/publicador/perfil/editar` (service_role, revalida el candado).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { normalizarWhatsapp } from "@/lib/eventos";
import { candadoContacto } from "@/lib/candadoContacto";
import { leerSesionPublicador } from "@/lib/sesionPublicador";
import EditarPerfilForm from "@/components/EditarPerfilForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu perfil · EnVivo",
  robots: { index: false, follow: false },
};

const SEGUIDORES_MIN_PUBLICO = 25;

const TIPO_ETIQUETA: Record<string, string> = {
  local: "Local",
  organizador: "Organizador",
  artista: "Artista",
};

export default async function MiPerfil() {
  const sesion = await leerSesionPublicador();
  if (!sesion?.perfilId) redirect("/registro");

  const [perfilRes, seguidoresRes] = await Promise.all([
    supabaseServidor
      .from("perfiles")
      .select("slug, nombre, tipo, instagram, whatsapp_publico, ultimo_cambio_contacto")
      .eq("id", sesion.perfilId)
      .maybeSingle(),
    supabaseServidor
      .from("seguimientos")
      .select("*", { count: "exact", head: true })
      .eq("perfil_id", sesion.perfilId),
  ]);

  const perfil = perfilRes.data as
    | {
        slug: string | null;
        nombre: string | null;
        tipo: string | null;
        instagram: string | null;
        whatsapp_publico: string | null;
        ultimo_cambio_contacto: string | null;
      }
    | null;

  const nombre = perfil?.nombre ?? sesion.nombre ?? "";
  const etiqueta = perfil?.tipo ? TIPO_ETIQUETA[perfil.tipo] ?? null : null;
  const { bloqueado, desbloqueaEn } = candadoContacto(
    perfil?.ultimo_cambio_contacto,
  );

  const seguidores = seguidoresRes.count ?? 0;
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
          instagram={perfil?.instagram ?? ""}
          whatsappPublico={normalizarWhatsapp(perfil?.whatsapp_publico)}
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
          {perfil?.slug && (
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
