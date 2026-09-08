// ⚠️ SOLO SERVIDOR. Alta y verificación del publicador por WhatsApp.
//
// Usa `supabaseServidor` (service_role) sobre las tablas `phone_codes` y
// `perfiles` de la Sesión 11. Nunca se importa desde el cliente.
//
// Modelo: la verdad de "este número está verificado" vive en `phone_codes`
// (una fila con `used_at` puesto, reciente). El `perfiles` se crea recién al
// final (/api/registro/perfil), ya con todos los datos. Así no quedan filas
// de perfil a medio hacer y `confirmarCodigo` no necesita saber el tipo.

import { supabaseServidor } from "@/lib/supabaseServidor";
import { normalizarWhatsapp } from "@/lib/eventos";
import type { TipoPerfil } from "@/lib/sesionPublicador";

export const TIPOS_PERFIL: {
  valor: TipoPerfil;
  icono: string;
  titulo: string;
  detalle: string;
  etiquetaNombre: string;
}[] = [
  {
    valor: "local",
    icono: "🏠",
    titulo: "Local",
    detalle: "Bar, restaurante, escuela, parque",
    etiquetaNombre: "Nombre del local",
  },
  {
    valor: "organizador",
    icono: "📋",
    titulo: "Organizador",
    detalle: "Monta eventos en distintos lugares",
    etiquetaNombre: "Nombre o marca",
  },
  {
    valor: "artista",
    icono: "🎤",
    titulo: "Artista",
    detalle: "Toca o se presenta en eventos de otros",
    etiquetaNombre: "Nombre artístico",
  },
];

export function esTipoPerfil(v: unknown): v is TipoPerfil {
  return v === "local" || v === "organizador" || v === "artista";
}

const VENTANA_MIN = 10; // vida de un código
const LIMITE_HORA = 3; // códigos por número por hora
const MAX_INTENTOS = 5; // fallos al confirmar un mismo código
const GRACIA_VERIFICADO_MIN = 30; // cuánto vale un `used_at` para el funnel

export type ResultadoCodigo =
  | { ok: true; codigo: string; expiraEn: string }
  | { ok: false; error: string; status: number };

/**
 * Genera y guarda un código de 4 dígitos para `whatsapp` (indicativo +
 * dígitos). Aplica el límite de 3 por hora por número.
 */
export async function generarCodigo(
  whatsappCrudo: string,
): Promise<ResultadoCodigo> {
  const whatsapp = normalizarWhatsapp(whatsappCrudo);
  if (whatsapp.length < 8) {
    return { ok: false, error: "El WhatsApp no parece válido.", status: 400 };
  }

  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: errConteo } = await supabaseServidor
    .from("phone_codes")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp", whatsapp)
    .gte("created_at", desde);

  if (errConteo) {
    return {
      ok: false,
      error: "No se pudo generar el código. Intentá de nuevo.",
      status: 500,
    };
  }
  if ((count ?? 0) >= LIMITE_HORA) {
    return {
      ok: false,
      error: "Pediste demasiados códigos. Esperá una hora e intentá de nuevo.",
      status: 429,
    };
  }

  const codigo = String(Math.floor(1000 + Math.random() * 9000));
  const expiraEn = new Date(Date.now() + VENTANA_MIN * 60 * 1000).toISOString();

  const { error } = await supabaseServidor.from("phone_codes").insert({
    whatsapp,
    codigo,
    expires_at: expiraEn,
  });
  if (error) {
    return {
      ok: false,
      error: "No se pudo generar el código. Intentá de nuevo.",
      status: 500,
    };
  }
  return { ok: true, codigo, expiraEn };
}

export type ResultadoConfirmar =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Valida `codigo` para `whatsapp`. Si coincide, marca la fila `used_at`.
 * Cada intento fallido sube `intentos`; pasados MAX_INTENTOS el código deja
 * de servir. La usan el panel de admin (confirmación manual) y, más
 * adelante, el webhook de WhatsApp.
 */
export async function confirmarCodigo(
  whatsappCrudo: string,
  codigoCrudo: string,
): Promise<ResultadoConfirmar> {
  const whatsapp = normalizarWhatsapp(whatsappCrudo);
  const codigo = String(codigoCrudo ?? "").replace(/\D/g, "");
  if (whatsapp.length < 8 || codigo.length !== 4) {
    return { ok: false, error: "Datos incompletos.", status: 400 };
  }

  const { data: fila } = await supabaseServidor
    .from("phone_codes")
    .select("id, codigo, intentos, used_at")
    .eq("whatsapp", whatsapp)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fila) {
    return {
      ok: false,
      error: "No hay un código vigente para ese número.",
      status: 404,
    };
  }
  if ((fila.intentos ?? 0) >= MAX_INTENTOS) {
    return {
      ok: false,
      error: "Demasiados intentos con este código. Hay que generar otro.",
      status: 429,
    };
  }
  if (fila.codigo !== codigo) {
    await supabaseServidor
      .from("phone_codes")
      .update({ intentos: (fila.intentos ?? 0) + 1 })
      .eq("id", fila.id);
    return { ok: false, error: "El código no coincide.", status: 401 };
  }

  const { error } = await supabaseServidor
    .from("phone_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", fila.id);
  if (error) {
    return {
      ok: false,
      error: "No se pudo confirmar. Intentá de nuevo.",
      status: 500,
    };
  }
  return { ok: true };
}

/**
 * ¿Este número completó la verificación hace poco? True si hay un
 * `phone_codes` suyo con `used_at` dentro de la ventana de gracia. Es lo que
 * consulta el polling de /registro/verificar.
 */
export async function estaVerificado(whatsappCrudo: string): Promise<boolean> {
  const whatsapp = normalizarWhatsapp(whatsappCrudo);
  if (whatsapp.length < 8) return false;

  const desde = new Date(
    Date.now() - GRACIA_VERIFICADO_MIN * 60 * 1000,
  ).toISOString();
  const { data } = await supabaseServidor
    .from("phone_codes")
    .select("id")
    .eq("whatsapp", whatsapp)
    .not("used_at", "is", null)
    .gte("used_at", desde)
    .limit(1)
    .maybeSingle();

  return !!data;
}

/** "Salsa Viva" → "salsa-viva". Vacío → "perfil". */
export function slugDesde(nombre: string): string {
  const base = (nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes y diéresis
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "perfil";
}

async function slugLibre(nombre: string): Promise<string> {
  const base = slugDesde(nombre);
  for (let i = 0; i < 12; i++) {
    const intento = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabaseServidor
      .from("perfiles")
      .select("id")
      .eq("slug", intento)
      .maybeSingle();
    if (!data) return intento;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export type DatosPerfil = {
  tipo: TipoPerfil;
  nombre: string;
  whatsapp: string; // cuenta (indicativo + dígitos)
  whatsappPublico: string;
  instagram: string | null;
  tiktok: string | null;
  imagenUrl: string | null;
};

export type ResultadoPerfil =
  | { ok: true; perfilId: string; nombre: string | null }
  | { ok: false; error: string; status: number };

/**
 * Crea el `perfiles` (o lo actualiza, si el número ya tenía uno). Exige que
 * `whatsapp` esté verificado. Devuelve el id para armar la sesión.
 */
export async function crearOActualizarPerfil(
  d: DatosPerfil,
): Promise<ResultadoPerfil> {
  const whatsapp = normalizarWhatsapp(d.whatsapp);
  if (!(await estaVerificado(whatsapp))) {
    return {
      ok: false,
      error: "Ese número todavía no está verificado.",
      status: 403,
    };
  }

  const campos = {
    tipo: d.tipo,
    nombre: d.nombre.trim() || null,
    whatsapp_publico: normalizarWhatsapp(d.whatsappPublico) || null,
    instagram: d.instagram?.trim() || null,
    tiktok: d.tiktok?.trim() || null,
    imagen_url: d.imagenUrl?.trim() || null,
    verified_at: new Date().toISOString(),
  };

  const { data: existente } = await supabaseServidor
    .from("perfiles")
    .select("id, nombre")
    .eq("whatsapp_cuenta", whatsapp)
    .maybeSingle();

  if (existente?.id) {
    const { error } = await supabaseServidor
      .from("perfiles")
      .update(campos)
      .eq("id", existente.id);
    if (error) {
      return { ok: false, error: "No se pudo guardar el perfil.", status: 500 };
    }
    return {
      ok: true,
      perfilId: existente.id,
      nombre: campos.nombre ?? existente.nombre ?? null,
    };
  }

  const { data: creado, error } = await supabaseServidor
    .from("perfiles")
    .insert({
      ...campos,
      whatsapp_cuenta: whatsapp,
      slug: await slugLibre(d.nombre),
    })
    .select("id, nombre")
    .single();

  if (error || !creado) {
    return { ok: false, error: "No se pudo crear el perfil.", status: 500 };
  }
  return { ok: true, perfilId: creado.id, nombre: creado.nombre ?? null };
}
