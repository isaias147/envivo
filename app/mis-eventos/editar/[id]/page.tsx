// Pantalla · /mis-eventos/editar/[id] — editar un evento publicado.
//
// Sesión 13, paso 6. Solo flyer, video y ubicación; sin re-revisión (se
// guarda directo). Nombre, hora y descripción no se editan acá.
//
// Server Component: comprueba la sesión y que el evento sea de ese perfil
// antes de mostrar nada. El formulario en sí es el cliente EditarEventoForm.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { leerSesionPublicador } from "@/lib/sesionPublicador";
import EditarEventoForm from "@/components/EditarEventoForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar evento · EnVivo",
  robots: { index: false, follow: false },
};

export default async function EditarEvento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sesion = await leerSesionPublicador();
  if (!sesion?.perfilId) redirect("/mis-eventos");

  const { data: evento } = await supabaseServidor
    .from("events")
    .select(
      "id, title, cover_url, post_url, latitude, longitude, perfil_id, series_id",
    )
    .eq("id", id)
    .maybeSingle();

  // No existe, o no es de este perfil → 404 (no se filtra de quién es).
  if (!evento || evento.perfil_id !== sesion.perfilId) notFound();

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/mis-eventos/editar</div>

        <h1 className={styles.tit}>Editar evento</h1>
        <p className={styles.bajada}>
          Cambios en <b className={styles.nombre}>{evento.title}</b>. El flyer,
          el video y la ubicación se guardan al instante.
        </p>

        <EditarEventoForm
          evento={{
            id: evento.id,
            title: evento.title,
            cover_url: evento.cover_url,
            post_url: evento.post_url,
            latitude: evento.latitude,
            longitude: evento.longitude,
            series_id: evento.series_id,
          }}
        />
      </div>
    </div>
  );
}
