"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  enlaceComoLlegar,
  enlaceWhatsapp,
  fechaLargaCali,
  horaCali,
  sinArroba,
  type EventoPublico,
} from "@/lib/eventos";
import BotonSeguir from "@/components/BotonSeguir";
import BotonDenunciar from "@/components/BotonDenunciar";
import styles from "./page.module.css";

type Estado = "cargando" | "listo" | "no-existe" | "error";

export default function EventoDetalle({ params }: PageProps<"/evento/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from("eventos_publicos")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!vivo) return;
      if (error) setEstado("error");
      else if (!data) setEstado("no-existe");
      else {
        setEvento(data as EventoPublico);
        setEstado("listo");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  // Cuenta la vista para el panel de métricas del publicador (Sesión 15).
  // Una sola vez por evento montado; el duplicado lo filtra el propio
  // servidor (unique por día), así que no hace falta más cuidado acá.
  useEffect(() => {
    fetch(`/api/eventos/${id}/vista`, { method: "POST" }).catch(() => {});
  }, [id]);

  // "Volver" a la pantalla anterior; si se entró directo al enlace, al mapa.
  function volver() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <button type="button" className={styles.volver} onClick={volver}>
          Volver
        </button>

        {estado !== "listo" || !evento ? (
          <p className={styles.mensaje}>
            {estado === "cargando" && "Cargando…"}
            {estado === "no-existe" &&
              "Este evento ya no está disponible. Puede que haya pasado o lo hayan quitado."}
            {estado === "error" && "No se pudo cargar el evento. Intenta de nuevo."}
          </p>
        ) : (
          <Detalle evento={evento} />
        )}
      </div>
    </div>
  );
}

const IconoPlay = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
  </svg>
);

const IconoIg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconoTk = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.5 3c.3 2.4 1.7 4 4 4.3v3.1c-1.5 0-2.9-.5-4-1.3v6.4a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v3.2a2.8 2.8 0 1 0 1.9 2.6V3h3.1z" />
  </svg>
);

function Detalle({ evento }: { evento: EventoPublico }) {
  const { hhmm, periodo } = horaCali(evento.starts_at);
  const precio = evento.is_free
    ? "Gratis"
    : evento.price_label ?? "Entrada paga";
  const publicadoPor = evento.publisher_name ?? evento.venue_name ?? "Organizador";
  // Los eventos ya migrados tienen un perfil público enlazado por `perfil_id`.
  // Los viejos no: en ese caso la tarjeta cae al nombre plano de siempre.
  const tienePerfil = Boolean(evento.perfil_id && evento.perfil_slug);
  const nombrePerfil = evento.perfil_nombre ?? publicadoPor;

  return (
    <>
      <div className={styles.cartel}>
        {evento.flyer_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={evento.flyer_url} alt={`Flyer de ${evento.title}`} />
        )}
        <div className={styles.velo} />
      </div>

      <div className={styles.cuerpo}>
        <div className={styles.hora}>
          {hhmm} {periodo}
        </div>
        <p className={styles.fecha}>
          {fechaLargaCali(evento.starts_at)}
          {evento.es_serie && " · Serie"}
        </p>
        <h1 className={styles.titulo}>{evento.title}</h1>

        {evento.description && (
          <p className={styles.desc}>{evento.description}</p>
        )}

        <div className={styles.datos}>
          <div className={styles.dato}>
            <b>Dónde</b>
            <span>
              {evento.venue_name}
              {evento.venue_address && (
                <>
                  <br />
                  {evento.venue_address}
                </>
              )}
            </span>
          </div>
          <div className={styles.dato}>
            <b>Entrada</b>
            <span className={evento.is_free ? styles.gratis : undefined}>
              {precio}
            </span>
          </div>
          {evento.type && (
            <div className={styles.dato}>
              <b>Tipo</b>
              <span>{evento.type}</span>
            </div>
          )}
        </div>

        <div className={styles.acciones}>
          {evento.whatsapp && (
            <a
              className={styles.wa}
              href={enlaceWhatsapp(evento.whatsapp, evento.title)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribir por WhatsApp
            </a>
          )}

          {evento.post_url && (
            <a
              className={styles.pub}
              href={evento.post_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconoPlay />
              Ver el reel
            </a>
          )}

          <a
            className={styles.sec}
            href={enlaceComoLlegar(evento.latitude, evento.longitude)}
          >
            Cómo llegar
          </a>
        </div>

        <div className={styles.autor}>
          <small>Publicado por</small>

          {tienePerfil ? (
            <Link
              href={`/p/${evento.perfil_slug}`}
              className={styles.perfilEnlace}
            >
              <span className={styles.perfilFoto}>
                {evento.perfil_imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={evento.perfil_imagen_url} alt="" />
                ) : (
                  <span>
                    {(nombrePerfil.trim()[0] ?? "?").toUpperCase()}
                  </span>
                )}
              </span>
              <span className={styles.perfilNombre}>{nombrePerfil}</span>
              <span className={styles.perfilVer} aria-hidden="true">
                Ver perfil ›
              </span>
            </Link>
          ) : (
            <b>{publicadoPor}</b>
          )}

          {tienePerfil && evento.perfil_id && (
            <div className={styles.seguirEvento}>
              <BotonSeguir perfilId={evento.perfil_id} nombre={nombrePerfil} />
            </div>
          )}

          <div className={styles.redes}>
            {evento.instagram && (
              <a
                className={styles.red}
                href={`https://instagram.com/${sinArroba(evento.instagram)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconoIg />@{sinArroba(evento.instagram)}
              </a>
            )}
            {evento.tiktok && (
              <a
                className={styles.red}
                href={`https://tiktok.com/@${sinArroba(evento.tiktok)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconoTk />@{sinArroba(evento.tiktok)}
              </a>
            )}
          </div>
        </div>

        <BotonDenunciar eventId={evento.id} />
      </div>
    </>
  );
}
