// /mis-eventos (sin token).
//
// Dos caminos, en paralelo:
//
//  - **Cuenta registrada** (cookie `envivo_publicador`, Sesión 12): trae sus
//    eventos por `perfil_id` (y, por si publicó antes de registrarse y aún
//    no hay backfill, también por su WhatsApp de cuenta) y muestra la lista
//    en las cuatro secciones de siempre.
//  - **Sin sesión**: pantalla puente. El organizador sin cuenta entra por su
//    link personal /mis-eventos/<token> (que le llega por WhatsApp). Sin ese
//    token no hay nada que mostrar; esta ruta solo explica dónde encontrarlo.
//
// La pantalla vieja /mis-eventos/[token] no se toca: sigue igual para el
// flujo por token.

import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { normalizarWhatsapp } from "@/lib/eventos";
import { leerSesionPublicador } from "@/lib/sesionPublicador";
import MisEventosLista, {
  type FilaMisEventos,
} from "@/components/MisEventosLista";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis eventos · EnVivo",
  robots: { index: false, follow: false },
};

const COLS_EVENTO =
  "id, title, cover_url, venue_name, starts_at, status, series_id, rejection_reason";

export default async function MisEventos() {
  const sesion = await leerSesionPublicador();

  // ---------- cuenta registrada: eventos por perfil ----------
  if (sesion?.perfilId) {
    const wa = normalizarWhatsapp(sesion.whatsapp);
    // Por `perfil_id` (lo que enlaza el form nuevo) o por el WhatsApp de la
    // cuenta (eventos publicados antes de registrarse, aún sin backfill).
    const filtro = wa
      ? `perfil_id.eq.${sesion.perfilId},whatsapp.eq.${wa}`
      : `perfil_id.eq.${sesion.perfilId}`;

    const { data } = await supabaseServidor
      .from("events")
      .select(COLS_EVENTO)
      .or(filtro)
      .order("starts_at", { ascending: true });

    const filas = (data ?? []) as FilaMisEventos[];

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
            {sesion.nombre ? (
              <>
                {" "}
                como <b className={styles.nombre}>{sesion.nombre}</b>
              </>
            ) : null}
            .
          </p>

          <MisEventosLista
            filas={filas}
            mensajeVacio="Todavía no has publicado nada. En cuanto envíes tu primer evento y lo revisemos, aparece aquí."
          />

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

  // ---------- sin sesión: pantalla puente ----------
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
