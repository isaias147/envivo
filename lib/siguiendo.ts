// Lógica de "a quién sigue el usuario final" (Sesión 14).
//
// Vive acá (no en app/siguiendo/page.tsx) para que la barra inferior pueda
// calcular el badge "Nuevo" con el MISMO criterio, sin duplicarlo.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "@/lib/authUsuario";

// "Nuevo" = evento publicado en las últimas 72 h.
export const NUEVO_MS = 72 * 60 * 60 * 1000;

export type PerfilSeguido = {
  id: string;
  slug: string | null;
  nombre: string | null;
  tipo: string | null;
  imagen_url: string | null;
};
export type EventoSeguido = {
  id: string;
  title: string;
  starts_at: string;
  is_free: boolean;
  perfil_id: string;
  created_at: string;
};
export type ItemSeguido = {
  perfil: PerfilSeguido;
  evento: EventoSeguido | null;
  nuevo: boolean;
};

/**
 * El próximo evento del perfil cuenta como "Nuevo" si se publicó
 * (`events.created_at`) en las últimas 72 h y después de la última vez que
 * el usuario entró a /siguiendo. Primera visita (sin `visitaPrevia`): solo
 * cuenta el límite de 72 h.
 */
export function esNuevo(createdAt: string, visitaPrevia: string | null): boolean {
  const t = new Date(createdAt).getTime();
  if (Date.now() - t > NUEVO_MS) return false;
  if (!visitaPrevia) return true;
  return t > new Date(visitaPrevia).getTime();
}

/**
 * Perfiles que sigue `userId`, cada uno con su próximo evento futuro (el más
 * cercano) y el flag `nuevo`. Orden: primero los que tienen evento (por
 * fecha), después los que no (en orden de follow).
 */
export async function traerSeguidos(
  userId: string,
  visitaPrevia: string | null,
): Promise<ItemSeguido[]> {
  const { data: segs, error } = await supabase
    .from("seguimientos")
    .select("perfil_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (segs ?? []).map((s) => s.perfil_id as string);
  if (ids.length === 0) return [];

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

  const proximo = new Map<string, EventoSeguido>();
  for (const ev of (evs ?? []) as EventoSeguido[]) {
    if (!proximo.has(ev.perfil_id)) proximo.set(ev.perfil_id, ev);
  }
  const porId = new Map<string, PerfilSeguido>();
  for (const p of (perfs ?? []) as PerfilSeguido[]) porId.set(p.id, p);

  const conEvento: ItemSeguido[] = [];
  const sinEvento: ItemSeguido[] = [];
  for (const id of ids) {
    const perfil = porId.get(id);
    if (!perfil) continue;
    const evento = proximo.get(id) ?? null;
    (evento ? conEvento : sinEvento).push({
      perfil,
      evento,
      nuevo: evento ? esNuevo(evento.created_at, visitaPrevia) : false,
    });
  }
  conEvento.sort((a, b) =>
    a.evento!.starts_at.localeCompare(b.evento!.starts_at),
  );
  return [...conEvento, ...sinEvento];
}

export type EstadoSeguidos = "cargando" | "sin-sesion" | "listo" | "error";

/**
 * Hook compartido: la lista de seguidos + el estado. NO marca la visita
 * (eso lo hace la pantalla /siguiendo, no la barra). Carga una vez por
 * usuario; los cambios de `user_metadata` no la re-disparan.
 */
export function useSeguidos(): { items: ItemSeguido[]; estado: EstadoSeguidos } {
  const { usuario, cargando } = useUsuario();
  const [items, setItems] = useState<ItemSeguido[]>([]);
  const [interno, setInterno] = useState<"cargando" | "listo" | "error">(
    "cargando",
  );
  const cargadoParaId = useRef<string | null>(null);

  useEffect(() => {
    if (cargando || !usuario) return;
    if (cargadoParaId.current === usuario.id) return;
    cargadoParaId.current = usuario.id;

    (async () => {
      const visitaPrevia =
        (usuario.user_metadata?.ultima_visita_siguiendo as string | undefined) ??
        null;
      try {
        setItems(await traerSeguidos(usuario.id, visitaPrevia));
        setInterno("listo");
      } catch {
        setInterno("error");
      }
    })();
  }, [usuario, cargando]);

  const estado: EstadoSeguidos = cargando
    ? "cargando"
    : !usuario
      ? "sin-sesion"
      : interno;
  return { items, estado };
}
