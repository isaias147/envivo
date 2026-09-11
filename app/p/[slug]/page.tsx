// Pantalla · /p/[slug] — perfil público de un local, organizador o artista.
// Sigue el slot 1 ("Perfil público — /p/[slug]") del mockup
// envivo-grupo1-publico.html.
//
// Server Component (como /mis-eventos/[token]): lee con la service_role key
// porque necesita contar filas de `seguimientos`, que por RLS solo puede
// leer el propio usuario logueado. NUNCA selecciona `celular_cuenta` (la
// clave privada del perfil, verificada por SMS — no es WhatsApp).
//
// - Perfil por `slug`; si no existe → 404.
// - "Próximos eventos": mini-mapa + lista, desde `eventos_publicos`
//   (ya filtra aprobados y futuros) por `perfil_id`.
// - "Pasados": últimos 10 desde `events` (la vista pública no trae pasados),
//   `status = 'aprobado'`, orden descendente.
// - Seguidores: se muestra el número solo si hay 25 o más (decisión de
//   CLAUDE.md: lista privada hasta 25, pública a partir de ahí).

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServidor } from "@/lib/supabaseServidor";
import { horaCali, normalizarWhatsapp, sinArroba } from "@/lib/eventos";
import MapaPerfilLazy from "@/components/MapaPerfilLazy";
import AccionesPerfil from "@/components/AccionesPerfil";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const SEGUIDORES_MIN_PUBLICO = 25;

const TIPO_ETIQUETA: Record<string, string> = {
  local: "Local",
  organizador: "Organizador",
  artista: "Artista",
};

type Perfil = {
  id: string;
  tipo: string;
  slug: string;
  nombre: string | null;
  instagram: string | null;
  tiktok: string | null;
  imagen_url: string | null;
  whatsapp_publico: string | null;
};

// Solo lo que muestran las filas del perfil y el mini-mapa.
type EventoRow = {
  id: string;
  title: string;
  starts_at: string;
  is_free: boolean;
  latitude: number;
  longitude: number;
};

// El perfil se pide en generateMetadata y en la página: `cache` evita la
// doble consulta dentro del mismo request.
const traerPerfil = cache(async (slug: string): Promise<Perfil | null> => {
  const { data } = await supabaseServidor
    .from("perfiles")
    .select(
      "id, tipo, slug, nombre, instagram, tiktok, imagen_url, whatsapp_publico",
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as Perfil | null) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const perfil = await traerPerfil(slug);
  if (!perfil) return { title: "Perfil no encontrado · EnVivo" };

  const etiqueta = TIPO_ETIQUETA[perfil.tipo] ?? "Publicador";
  const nombre = perfil.nombre ?? "Perfil";
  return {
    title: `${nombre} · EnVivo`,
    description: `${etiqueta} en EnVivo. Mirá sus próximos eventos en Cali.`,
    openGraph: perfil.imagen_url ? { images: [perfil.imagen_url] } : undefined,
  };
}

export default async function PerfilPublico({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const perfil = await traerPerfil(slug);
  if (!perfil) notFound();

  const ahora = new Date().toISOString();
  const colsVista = "id, title, starts_at, is_free, latitude, longitude";
  const colsTabla = colsVista; // mismos nombres en la tabla `events`

  const [proximosRes, pasadosRes, seguidoresRes] = await Promise.all([
    supabaseServidor
      .from("eventos_publicos")
      .select(colsVista)
      .eq("perfil_id", perfil.id)
      .gte("starts_at", ahora)
      .order("starts_at", { ascending: true }),
    supabaseServidor
      .from("events")
      .select(colsTabla)
      .eq("perfil_id", perfil.id)
      .eq("status", "aprobado")
      .lt("starts_at", ahora)
      .order("starts_at", { ascending: false })
      .limit(10),
    supabaseServidor
      .from("seguimientos")
      .select("*", { count: "exact", head: true })
      .eq("perfil_id", perfil.id),
  ]);

  const proximos = (proximosRes.data as EventoRow[] | null) ?? [];
  const pasados = (pasadosRes.data as EventoRow[] | null) ?? [];

  const seguidores = seguidoresRes.count ?? 0;
  const mostrarConteo = seguidores >= SEGUIDORES_MIN_PUBLICO;

  const puntos = proximos
    .filter((e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))
    .map((e) => ({ id: e.id, lat: e.latitude, lng: e.longitude }));

  const nombre = perfil.nombre ?? "Este perfil";
  const etiqueta = TIPO_ETIQUETA[perfil.tipo] ?? "Publicador";
  const inicial = (nombre.trim()[0] ?? "?").toUpperCase();
  const waPublico = normalizarWhatsapp(perfil.whatsapp_publico) || null;
  const ig = perfil.instagram ? sinArroba(perfil.instagram) : null;
  const tk = perfil.tiktok ? sinArroba(perfil.tiktok) : null;

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.cover}>
          <Link href="/" className={styles.back} aria-label="Volver al mapa">
            ←
          </Link>
        </div>

        <div className={styles.foto}>
          {perfil.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.imagen_url} alt={`Foto de ${nombre}`} />
          ) : (
            <span>{inicial}</span>
          )}
        </div>

        <div className={styles.cuerpo}>
          <h1 className={styles.nombre}>{nombre}</h1>
          <span className={styles.chipTipo}>{etiqueta}</span>

          {(ig || tk) && (
            <div className={styles.redes}>
              {ig && (
                <a
                  href={`https://instagram.com/${ig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{ig}
                </a>
              )}
              {ig && tk && <span aria-hidden="true"> · </span>}
              {tk && (
                <a
                  href={`https://tiktok.com/@${tk}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{tk}
                </a>
              )}
            </div>
          )}

          {mostrarConteo && (
            <p className={styles.seguidores}>
              {seguidores.toLocaleString("es-CO")} seguidores
            </p>
          )}

          <AccionesPerfil
            perfilId={perfil.id}
            nombre={nombre}
            whatsappPublico={waPublico}
          />

          <div className={styles.rotulo}>Próximos eventos</div>
          {proximos.length === 0 ? (
            <p className={styles.vacio}>
              {nombre} no tiene eventos próximos por ahora.
            </p>
          ) : (
            <>
              {puntos.length > 0 && (
                <div className={styles.mapaCaja}>
                  <MapaPerfilLazy puntos={puntos} />
                </div>
              )}
              <div className={styles.eventos}>
                {proximos.map((ev) => (
                  <FilaEventoPerfil key={ev.id} ev={ev} />
                ))}
              </div>
            </>
          )}

          {pasados.length > 0 && (
            <>
              <div className={styles.rotulo}>Pasados</div>
              <div className={styles.eventos}>
                {pasados.map((ev) => (
                  <FilaEventoPerfil key={ev.id} ev={ev} pasado />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Un renglón de evento: hora en latón (o "Gratis" en verde) + nombre. */
function FilaEventoPerfil({ ev, pasado }: { ev: EventoRow; pasado?: boolean }) {
  const { hhmm, periodo } = horaCali(ev.starts_at);
  return (
    <Link
      href={`/evento/${ev.id}`}
      className={`${styles.fila} ${pasado ? styles.pasado : ""}`}
    >
      <span
        className={`${styles.hora} ${ev.is_free ? styles.gratis : ""}`}
      >
        {ev.is_free ? "Gratis" : `${hhmm}${periodo}`}
      </span>
      <span className={styles.nombreEv}>{ev.title}</span>
    </Link>
  );
}
