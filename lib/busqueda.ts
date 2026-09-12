// ===== EnVivo · búsqueda combinada (eventos + perfiles) =====
// Envuelve el RPC `buscar_envivo` de Supabase (full-text + trigram sobre
// `events` y `perfiles`; ya filtra aprobados y no ocultos por denuncias).
// Puro dato: el estado del input y el debounce viven en
// components/Buscador.tsx.

import { supabase } from "@/lib/supabase";

export type ResultadoBusqueda = {
  tipo: "evento" | "perfil";
  id: string;
  titulo: string;
  subtitulo: string | null;
  latitude: number | null;
  longitude: number | null;
  slug: string | null;
  imagen_url: string | null;
  rank: number;
};

export async function buscarEnvivo(
  termino: string,
): Promise<ResultadoBusqueda[]> {
  const { data, error } = await supabase.rpc("buscar_envivo", { termino });
  if (error) throw error;
  return (data as ResultadoBusqueda[]) ?? [];
}
