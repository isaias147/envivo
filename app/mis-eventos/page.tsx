// /mis-eventos (sin token) — pantalla puente.
//
// El organizador no tiene cuenta: su acceso es el link personal
// /mis-eventos/<token> que le pasamos por WhatsApp al aprobarle el primer
// evento. Sin ese token no hay nada que mostrar, así que esta ruta solo
// explica dónde encontrarlo. El botón "Mis eventos" de /publicar apunta aquí.

import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Mis eventos · EnVivo",
  robots: { index: false, follow: false },
};

export default function MisEventosPuente() {
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
