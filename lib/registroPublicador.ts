// ⚠️ SOLO SERVIDOR. Alta y verificación del publicador por SMS (Twilio Verify).
//
// Usa `supabaseServidor` (service_role) sobre la tabla `perfiles` de la
// Sesión 11. Nunca se importa desde el cliente.
//
// Verificación: la generación, expiración y reintentos del código los maneja
// **Twilio Verify** de su lado. Acá solo hay dos llamadas HTTP a su API:
// `iniciarVerificacion` (les pide que manden el SMS) y `comprobarCodigo`
// (les pasa lo que escribió el usuario y pregunta si está bien). La "verdad"
// de "este número quedó verificado" NO vive en la base: vive en la cookie
// firmada `envivo_registro` (flag `verificado`, que solo pone el servidor).
// El `perfiles` se crea recién al final (/api/registro/perfil).

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

// Largo del código que manda Twilio Verify. El servicio de Verify tiene que
// estar configurado en la consola de Twilio con "Code Length = 4" para que
// coincida con las 4 casillas de /registro/verificar.
export const LARGO_CODIGO = 4;

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_SERVICE = process.env.TWILIO_VERIFY_SERVICE_SID || "";

export type ResultadoVerificacion =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Una llamada POST a la API de Twilio Verify. `recurso` es "Verifications"
 * (mandar el SMS) o "VerificationCheck" (comprobar el código). Autentica con
 * Basic auth (AccountSid:AuthToken) y manda los campos como formulario, que
 * es lo que espera Twilio. Devuelve el `status` que reporta Twilio
 * ("pending" / "approved" / "canceled" …).
 */
async function llamarTwilio(
  recurso: "Verifications" | "VerificationCheck",
  campos: Record<string, string>,
): Promise<
  { ok: true; estado: string } | { ok: false; error: string; status: number }
> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_SERVICE) {
    return {
      ok: false,
      error: "Falta configurar Twilio Verify en el servidor.",
      status: 500,
    };
  }

  const url = `https://verify.twilio.com/v2/Services/${TWILIO_SERVICE}/${recurso}`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(campos).toString(),
    });
  } catch {
    return {
      ok: false,
      error: "No se pudo contactar el servicio de SMS. Probá de nuevo.",
      status: 502,
    };
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { status?: string; code?: number; message?: string }
    | null;

  if (!respuesta.ok) {
    return {
      ok: false,
      error: mensajeErrorTwilio(respuesta.status, cuerpo?.code),
      status: respuesta.status === 429 ? 429 : 400,
    };
  }

  return { ok: true, estado: String(cuerpo?.status ?? "") };
}

/** Traduce los errores más comunes de Twilio Verify a algo legible. */
function mensajeErrorTwilio(http: number, codigo?: number): string {
  if (http === 429 || codigo === 60203) {
    return "Pediste demasiados códigos. Esperá un rato e intentá de nuevo.";
  }
  if (codigo === 60200) return "Ese número no parece válido.";
  if (codigo === 60202) {
    return "Demasiados intentos con este código. Pedí uno nuevo.";
  }
  if (http === 404) return "El código venció. Pedí uno nuevo.";
  return "No se pudo verificar el número. Intentá de nuevo.";
}

/**
 * Le pide a Twilio Verify que mande un SMS con un código al `whatsapp`
 * (indicativo + dígitos, sin `+`). Twilio se encarga de generarlo, de que
 * expire y del tope de reenvíos.
 */
export async function iniciarVerificacion(
  whatsappCrudo: string,
): Promise<ResultadoVerificacion> {
  const whatsapp = normalizarWhatsapp(whatsappCrudo);
  if (whatsapp.length < 8) {
    return { ok: false, error: "El WhatsApp no parece válido.", status: 400 };
  }

  const res = await llamarTwilio("Verifications", {
    To: `+${whatsapp}`,
    Channel: "sms",
  });
  if (!res.ok) return res;
  return { ok: true };
}

/**
 * Le pasa a Twilio Verify el `codigo` que escribió el usuario para ese
 * `whatsapp`. `ok: true` solo si Twilio responde `status: "approved"`.
 */
export async function comprobarCodigo(
  whatsappCrudo: string,
  codigoCrudo: string,
): Promise<ResultadoVerificacion> {
  const whatsapp = normalizarWhatsapp(whatsappCrudo);
  const codigo = String(codigoCrudo ?? "").replace(/\D/g, "");
  if (whatsapp.length < 8 || codigo.length !== LARGO_CODIGO) {
    return { ok: false, error: "Escribí el código completo.", status: 400 };
  }

  const res = await llamarTwilio("VerificationCheck", {
    To: `+${whatsapp}`,
    Code: codigo,
  });
  if (!res.ok) return res;
  if (res.estado !== "approved") {
    return { ok: false, error: "El código no coincide o venció.", status: 401 };
  }
  return { ok: true };
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
 * Crea el `perfiles` (o lo actualiza, si el número ya tenía uno). El chequeo
 * de "este número está verificado" lo hace la ruta que llama a esta función,
 * leyendo el flag de la cookie `envivo_registro`. Devuelve el id para armar
 * la sesión.
 */
export async function crearOActualizarPerfil(
  d: DatosPerfil,
): Promise<ResultadoPerfil> {
  const whatsapp = normalizarWhatsapp(d.whatsapp);

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
