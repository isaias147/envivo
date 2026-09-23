#!/usr/bin/env node
/*
 * EnVivo · cookie de sesión de publicador para QA manual
 * -------------------------------------------------------------------------
 * Genera y firma el VALOR de la cookie `envivo_publicador` (ver
 * lib/sesionPublicador.ts, crearTokenPublicador) para el perfil de prueba
 * "Prueba QA" (slug prueba-qa, perfiles.id
 * cb185e66-89c4-4247-84b4-9817e24888bd), sin levantar ningún servidor ni
 * exponer nada por URL.
 *
 * Por qué existe: `envivo_publicador` es httpOnly (no se puede escribir con
 * `document.cookie` desde la página) y ningún código de este repo la pone
 * hoy — el flujo que la generaba vivía en app/registro/*, borrado en el
 * commit dda6cd1 al mover el alta a envivo-publisher. Sin este script no
 * hay forma de probar /panel ni /mis-eventos/editar/[id] sin pasar por ese
 * otro repo.
 *
 * Uso:
 *   node scripts/generar-cookie-publicador-qa.mjs
 *
 * Imprime SOLO el valor de la cookie por stdout. Para usarla:
 *   1. Abrí el sitio en Chrome (localhost:3000 o el dominio que sea).
 *   2. DevTools → Application → Cookies → esa URL.
 *   3. Agregá (o editá) una cookie `envivo_publicador` con este valor,
 *      Path=/, HttpOnly marcado si el editor te deja, SameSite=Lax.
 *   4. Recargá /panel o /mis-eventos/editar/[id].
 *   La cookie dura 30 días desde que corrés el script (igual que en
 *   producción); volvé a correrlo si expira.
 *
 * ⚠️ No commitear el valor que imprime a ningún lado (chat, PR, issue): con
 * él cualquiera entra a /panel como "Prueba QA". Es solo para pegar en tu
 * propio navegador. Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local (el
 * mismo secreto que usa el server para firmar sesiones reales).
 *
 * Arreglo de fondo (no este script): migrar /panel y
 * /mis-eventos/editar/[id] a useCuentaPublicador() (Bearer de Google), el
 * mismo patrón que ya usan /mis-eventos, /perfil y /publicar/nuevo. Ver
 * decisions-and-learnings.md. El día que eso pase, este script y la cookie
 * envivo_publicador dejan de hacer falta para QA.
 */

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const RAIZ = new URL("../", import.meta.url);

function cargarEnv(url) {
  let texto;
  try {
    texto = readFileSync(url, "utf8");
  } catch {
    return {};
  }
  const env = {};
  for (const linea of texto.split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i === -1) continue;
    env[l.slice(0, i).trim()] = l
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...cargarEnv(new URL(".env.local", RAIZ)), ...process.env };
const secreto = env.ADMIN_SESSION_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
if (!secreto) {
  console.error(
    "Falta SUPABASE_SERVICE_ROLE_KEY (o ADMIN_SESSION_SECRET) en .env.local",
  );
  process.exit(1);
}

// ---- misma técnica que lib/sesionPublicador.ts, reproducida acá a propósito
// (es un script de un solo uso, no vale la pena importar server-only code) ----
function base64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function firmar(carga) {
  return base64url(createHmac("sha256", secreto).update(carga).digest());
}
function empaquetar(datos) {
  const carga = base64url(Buffer.from(JSON.stringify(datos), "utf8"));
  return `${carga}.${firmar(carga)}`;
}

const SESION_DIAS = 30;

// Perfil de prueba "Prueba QA" (ver tasks/todo.md, checkpoint final, y
// decisions-and-learnings.md para el resto de los datos: evento, token de
// access_tokens, usuario de auth.users).
const PERFIL_ID = process.argv[2] ?? "cb185e66-89c4-4247-84b4-9817e24888bd";
const NOMBRE = process.argv[3] ?? "Prueba QA";
const CELULAR = process.argv[4] ?? "570000000001";

const datos = {
  perfilId: PERFIL_ID,
  nombre: NOMBRE,
  celular: CELULAR,
  exp: Math.floor(Date.now() / 1000) + SESION_DIAS * 24 * 3600,
};

console.log(empaquetar(datos));
