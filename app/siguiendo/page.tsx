"use client";

// Pantalla · /siguiendo — a quién sigue el usuario final (Sesión 14, paso 3).
// Sigue los slots 3 y 3b de envivo-grupo1-publico.html.
//
// Client Component: la sesión del usuario final vive en Supabase Auth
// (localStorage), no en cookie de servidor. Sin sesión → estado vacío con
// botón para entrar (no se abre el modal solo).
//
// "Nuevo" = el próximo evento del perfil se publicó (`events.created_at`) en
// las últimas 72 h y después de la última vez que el usuario entró acá
// (`user_metadata.ultima_visita_siguiendo`). Primera visita: solo el límite
// de 72 h.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { horaCali } from "@/lib/eventos";
import { useUsuario } from "@/lib/authUsuario";
import ModalEntrarConGoogle from "@/components/ModalEntrarConGoogle";
import styles from "./page.module.css";

const NUEVO_MS = 72 * 60 * 60 * 1000;

type Perfil = {
  id: string;
  slug: string | null;
  nombre: string | null;
  tipo: string | null;
  imagen_url: string | null;
};
type Evento = {
  id: string;
  title: string;
  starts_at: string;
  is_free: boolean;
  perfil_id: string;
  created_at: string;
};
type Item = { perfil: Perfil; evento: Evento | null; nuevo: boolean };

const ICONO_TIPO: Record<string, string> = {
  local: "🏠",
  organizador: "📋",
  artista: "🎤",
};

function esNuevo(createdAt: string, visitaPrevia: string | null): boolean {
  const t = new Date(createdAt).getTime();
  if (Date.now() - t > NUEVO_MS) return false;
  if (!visitaPrevia) return true;
  return t > new Date(visitaPrevia).getTime();
}

/** "Viernes 9:00pm — Jam de salsa" */
function lineaEvento(ev: Evento): string {
  const dia = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
  }).format(new Date(ev.starts_at));
  const { hhmm, periodo } = horaCali(ev.starts_at);
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${diaCap} ${hhmm}${periodo} — ${ev.title}`;
}

type Estado = "cargando" | "listo" | "error";

export default function Siguiendo() {
  const { usuario, cargando } = useUsuario();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [items, setItems] = useState<Item[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const cargadoParaId = useRef<string | null>(null);

  // Deja el sello de "visto ahora" para la próxima vez. No bloquea nada.
  const marcarVisita = useCallback(() => {
    supabase.auth
      .updateUser({
        data: { ultima_visita_siguiendo: new Date().toISOString() },
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cargando || !usuario) return;
    if (cargadoParaId.current === usuario.id) return;
    cargadoParaId.current = usuario.id;

    (async () => {
      const visitaPrevia =
        (usuario.user_metadata?.ultima_visita_siguiendo as string | undefined) ??
        null;

      const { data: segs, error: e1 } = await supabase
        .from("seguimientos")
        .select("perfil_id, created_at")
        .eq("user_id", usuario.id)
        .order("created_at", { ascending: false });
      if (e1) {
        setEstado("error");
        return;
      }

      const ids = (segs ?? []).map((s) => s.perfil_id as string);
      if (ids.length === 0) {
        setItems([]);
        setEstado("listo");
        marcarVisita();
        return;
      }

      const [{ data: perfs }, { data: evs }] = await Promise.all([
        supabase
          .from("perfiles")
          .select("id, slug, nombre, tipo, imagen_url")
          .in("id", ids),
        supabase
          .from("events")
          .select("id, title, starts_at, is_free, perfil_id, created_at")
          .in("perfil_id", ids)
          .eq("status", "aprobado")
          .gt("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true }),
      ]);

      // Primer (más próximo) evento futuro por perfil.
      const proximo = new Map<string, Evento>();
      for (const ev of (evs ?? []) as Evento[]) {
        if (!proximo.has(ev.perfil_id)) proximo.set(ev.perfil_id, ev);
      }
      const porId = new Map<string, Perfil>();
      for (const p of (perfs ?? []) as Perfil[]) porId.set(p.id, p);

      // Orden: primero los que tienen próximo evento, por fecha; después los
      // que no, en el orden en que se siguieron.
      const conEvento: Item[] = [];
      const sinEvento: Item[] = [];
      for (const id of ids) {
        const perfil = porId.get(id);
        if (!perfil) continue;
        const evento = proximo.get(id) ?? null;
        const item: Item = {
          perfil,
          evento,
          nuevo: evento ? esNuevo(evento.created_at, visitaPrevia) : false,
        };
        (evento ? conEvento : sinEvento).push(item);
      }
      conEvento.sort((a, b) =>
        a.evento!.starts_at.localeCompare(b.evento!.starts_at),
      );

      setItems([...conEvento, ...sinEvento]);
      setEstado("listo");
      marcarVisita();
    })();
  }, [usuario, cargando, marcarVisita]);

  return (
    <div className={styles.pantalla}>
      <header className={styles.top}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <Link href="/" className={styles.verMapa}>
          Ver mapa
        </Link>
      </header>

      <h1 className={styles.titulo}>Siguiendo</h1>

      {cargando ? (
        <p className={styles.info}>Cargando…</p>
      ) : !usuario ? (
        <div className={styles.vacio}>
          <p>
            Entrá con tu cuenta para ver acá a los locales, organizadores y
            artistas que seguís y su próximo evento.
          </p>
          <button
            type="button"
            className={styles.entrar}
            onClick={() => setModalAbierto(true)}
          >
            Entrar con Google
          </button>
        </div>
      ) : estado === "error" ? (
        <p className={styles.info}>
          No se pudo cargar. Recargá la página e intentá de nuevo.
        </p>
      ) : estado === "cargando" ? (
        <p className={styles.info}>Cargando…</p>
      ) : items.length === 0 ? (
        <div className={styles.vacio}>
          <p>
            Todavía no seguís a nadie. Tocá “Seguir” en cualquier perfil o
            evento y aparece acá.
          </p>
        </div>
      ) : (
        <ul className={styles.lista}>
          {items.map(({ perfil, evento, nuevo }) => (
            <li key={perfil.id}>
              <Link
                href={perfil.slug ? `/p/${perfil.slug}` : "#"}
                className={styles.tarjeta}
              >
                <span className={styles.avatar}>
                  {perfil.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={perfil.imagen_url} alt="" />
                  ) : (
                    (perfil.tipo && ICONO_TIPO[perfil.tipo]) || "•"
                  )}
                </span>
                <span className={styles.datos}>
                  <span className={styles.nombre}>
                    {perfil.nombre ?? "Perfil"}
                  </span>
                  <span className={styles.prox}>
                    {evento ? lineaEvento(evento) : "Sin eventos próximos"}
                  </span>
                </span>
                {nuevo && <span className={styles.nuevo}>Nuevo</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ModalEntrarConGoogle
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Entra a EnVivo"
        descripcion="Con tu cuenta ves acá a los locales, organizadores y artistas que seguís y recibís un aviso cuando publican algo nuevo."
      />
    </div>
  );
}
