// Pantalla 9 · /panel — inicio del publicador. PLACEHOLDER.
//
// La Sesión 12 solo necesita que exista y reciba la sesión recién creada.
// El contenido real (y la decisión sobre qué métricas mostrar, que hoy
// chocan con la línea roja) es de la Sesión 15. Server Component: lee la
// cookie `envivo_publicador` y, si no hay, manda a /registro.

import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionPublicador } from "@/lib/sesionPublicador";
import styles from "./page.module.css";

export default async function Panel() {
  const sesion = await leerSesionPublicador();
  if (!sesion) redirect("/registro");

  // Link a /mis-eventos si ese WhatsApp ya tiene token.
  const { data: tk } = await supabaseServidor
    .from("access_tokens")
    .select("token")
    .eq("whatsapp", sesion.whatsapp)
    .maybeSingle();
  const misEventos = tk?.token ? `/mis-eventos/${tk.token}` : "/mis-eventos";

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/panel</div>

        <h1 className={styles.tit}>Hola, {sesion.nombre ?? "publicador"}</h1>
        <p className={styles.bajada}>
          Tu cuenta ya está lista. Desde acá vas a manejar tus eventos y tu
          perfil.
        </p>

        <nav className={styles.accesos}>
          <Link className={styles.acceso} href="/publicar">
            <span>Publicar evento</span>
            <span className={styles.flecha}>→</span>
          </Link>
          <Link className={styles.acceso} href={misEventos}>
            <span>Mis eventos</span>
            <span className={styles.flecha}>→</span>
          </Link>
          <span className={`${styles.acceso} ${styles.pronto}`}>
            <span>Editar perfil</span>
            <span className={styles.flecha}>pronto</span>
          </span>
          <span className={`${styles.acceso} ${styles.pronto}`}>
            <span>Ver mi perfil público</span>
            <span className={styles.flecha}>pronto</span>
          </span>
        </nav>

        <form action="/api/registro/logout" method="post">
          <button type="submit" className={styles.salir}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
