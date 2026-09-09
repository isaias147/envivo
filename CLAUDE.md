# EnVivo

PWA de eventos en vivo en Cali. Responde una sola pregunta: **¿qué hay pasando cerca de mí esta noche?**

Habla conmigo en español. Soy principiante: explícame qué vas a hacer antes de ejecutarlo, y no des por hecho que entiendo la terminología.

---

## Decisiones fijas (no re-litigar en ninguna sesión)

Estas decisiones ya se tomaron y se evaluaron a fondo. Una sesión de Claude Code
**no las revierte ni las "mejora"** por su cuenta. Si algo parece que hace falta
cambiar, se me pregunta primero.

- **Una sola PWA, dos entradas por rol:** `/` para el público, `/publicar` para
  el publicador. **Nunca** dos apps separadas.
- **Mapa: OpenStreetMap servido por Stadia Maps, en modo oscuro.** No Google Maps
  (decisión final tras evaluar costos). El detalle de tiles y filtro está en la
  memoria `tiles-mapa-oscuro`; el estilo objetivo es *Alidade Smooth Dark* del
  mismo proveedor (no se suma un proveedor nuevo).
- **POI (lugares de interés):** se cargan desde un **archivo de descarga** ya
  definido (export puntual), **no** desde una API en vivo.
- **Sin estrellas, sin reseñas, sin recomendaciones.** El mapa es **cronológico**;
  no hay ranking ni puja por posición.
- **Registro del público:** con Google, **opcional**, solo para seguir
  publicadores y recibir avisos. **Planeado para Fase 2 (Sesión 14 del spec).**
  Hoy **no existe**: el usuario nunca ve un login.
- **Registro del publicador:** número verificado por **SMS con código de 4
  dígitos vía Twilio Verify**, nunca Google. **Planeado (Fase 2).** Hoy el
  publicador tampoco ve login: el acceso es por link de QR/WhatsApp.
  (Antes se hizo por `wa.me`; se cambió porque el número no se pudo registrar
  como empresa en Meta. Twilio Verify maneja generación, expiración y
  reintentos del código de su lado.)
- **Seguidores:** la lista de un publicador es **privada hasta 25**; **pública**
  a partir de ahí. (Fase 2.)
- **Monetización (sin puja por posición):** dos productos —
  - *Pin destacado* por evento puntual: **$15.000–20.000 COP**.
  - *Perfil destacado* mensual: **$40.000–60.000 COP**.
  - **3 meses gratis** de lanzamiento.

---

## Stack

- **Next.js** (App Router) como PWA — instalable, con manifiesto y service worker
- **Supabase** — proyecto ya existente, tablas ya creadas (no crear tablas nuevas sin avisarme)
- **react-leaflet + OpenStreetMap** para el mapa, servido por **Stadia Maps** en
  modo oscuro (requiere `NEXT_PUBLIC_STADIA_API_KEY`; ver memoria
  `tiles-mapa-oscuro`). **Sin Google Maps.**
- **POI** (lugares de interés bajo los pines): archivo de descarga estático ya
  definido, no una API en vivo.
- **Netlify** para el deploy
- Móvil primero. Todo se diseña para una pantalla de 380px de ancho.

## Supabase

- URL del proyecto: `https://ktzrqeoemyzqdcljqeaq.supabase.co`
- El frontend usa **solo la anon key**, en variables de entorno.
- La **service_role key NUNCA va en el frontend**. Solo en rutas de servidor (API routes). Si la ves en código de cliente, detente y avísame.
- Tabla principal: `events`. Vista pública: `eventos_publicos` (ya filtra aprobados y futuros).
- Función de choques: `hay_choque(whatsapp, lat, lng, starts_at)`.
- **WhatsApp del organizador**: se guarda como indicativo de país + dígitos, sin espacios ni símbolos (`573001234567`). El formulario `/publicar/nuevo` tiene un selector de país (`PAISES_WHATSAPP` en `lib/eventos.ts`; Colombia +57 por defecto). Helpers: `componerWhatsapp(indicativo, campo)` (solo el formulario antepone indicativo, con esto), `normalizarWhatsapp()` (solo limpia caracteres, nunca antepone nada — para comparar en panel/tokens/`/mis-eventos`), `formatearWhatsapp()` (para mostrar). Es la clave que une `events.whatsapp`, `access_tokens.whatsapp` y `hay_choque`. El `phone` del admin es otro campo y no se toca.
- Login admin: `verificar_admin(phone, pin)`. Cambio de PIN: `cambiar_pin_admin(phone, pin_actual, pin_nuevo)` (PIN nuevo de 4 dígitos). Ambas solo desde API routes del servidor.
- Vista de duplicados: `posibles_duplicados`.
- Bucket de flyers: `flyers` (público, 3 MB, solo JPG/PNG/WebP).
- Tablas `admins` y `access_tokens`: cerradas al cliente, solo desde servidor.

### Capa de identidad (Sesión 11 — andamiaje de Fase 2, todavía sin UI)

- `perfiles` — perfil público de EnVivo: `tipo` (`local`/`organizador`/`artista`), `slug`, `nombre`, `whatsapp_cuenta` (**clave privada, no se expone al cliente** — se oculta por privilegios de columna), `whatsapp_publico`, redes, `imagen_url`, `verified_at`, `seguidores_publicos`. RLS: lectura pública; escritura solo servidor (la policy de "dueño" se añade en Sesión 14, cuando exista la auth del publicador).
- ~~`phone_codes`~~ — **sin uso desde el cambio a Twilio Verify** (Sesión 12b). El código de verificación ahora lo genera y valida Twilio de su lado; la "verdad" de que un número quedó verificado vive en el flag `verificado` de la cookie firmada `envivo_registro`. La tabla sigue existiendo vacía en Supabase: se puede dropear con `drop table public.phone_codes;` (arrastra la policy `phone_codes_no_client`).
- `seguimientos` — un `auth.users` sigue a un `perfiles`. PK `(user_id, perfil_id)`. RLS: insert/delete/select solo del propio `user_id`.
- `events.perfil_id` — FK opcional a `perfiles`. **Convive** con los campos planos (`publisher_*`, `whatsapp`); no hay backfill todavía.
- `eventos_publicos` ahora hace LEFT JOIN a `perfiles` y expone `perfil_slug`, `perfil_nombre`, `perfil_tipo`, `perfil_imagen_url`, `perfil_verificado`, `perfil_seguidores_publicos`.
- **Ojo:** la base arrastra un esquema grande de otra app (`profiles`, `follows`, `businesses`, `organizers`, `artists`, `influencers`, `offers`, `checkins`, `trending_scores`, `push_tokens`, `saved_items`, `influencer_reviews`). EnVivo **no lo usa** — no confundir `profiles` (app vieja, 1:1 con `auth.users`) con `perfiles` (EnVivo). Ver memoria `esquema-supabase-real`.

---

## Las pantallas

**Usuario (sin registro, nunca ve un login):**
1. `/` — mapa con pines, geolocalización, radio 1/3/5 km, filtro Hoy / Este finde / Próximos
2. `/lista` — los mismos eventos en lista
3. `/evento/[id]` — detalle

> Fase 2 (Sesión 14 del spec): login con Google **opcional** para seguir
> publicadores y recibir avisos. No se adelanta; hoy el usuario nunca ve un login.

**Organizador (sin registro, link entregado por QR o WhatsApp):**
4. `/publicar` — el mapa con botón "Publicar evento"
5. `/publicar/nuevo` — el formulario
6. `/mis-eventos/[token]` — lo que ha publicado ese WhatsApp, en cuatro
   secciones (En el mapa / En revisión / No publicado / Ya pasaron). Solo
   lectura. El token vive en `access_tokens` y se genera (o se reutiliza)
   desde la API route del servidor al aprobar o fusionar el primer evento
   de ese WhatsApp.
   `/mis-eventos` (sin token) es una pantalla-puente: no hay nada que
   mostrar sin el link personal, así que solo explica dónde encontrarlo.
   (Añadida después del arranque; es la única pantalla extra del organizador.)

**Alta del publicador (Sesión 12 — verificación por SMS con Twilio Verify, sin Google):**
- `/registro` — paso 1: elegir tipo (local/organizador/artista). Paso 2:
  nombre + WhatsApp de cuenta. Al enviar → `/api/registro/iniciar` le pide a
  Twilio Verify que mande un SMS con el código al número, y deja la cookie
  provisional `envivo_registro` (todavía sin el flag `verificado`).
- `/registro/verificar` — 4 casillas donde el usuario escribe el código que
  le llegó por SMS. "Verificar" → `/api/registro/verificar` se lo pasa a
  Twilio (`VerificationCheck`); si Twilio responde `approved`, re-firma la
  cookie `envivo_registro` con `verificado: true` y sigue a
  `/registro/perfil`. Botón "Reenviar SMS" → `/api/registro/reenviar`. Sin
  polling, sin `wa.me`.
- `/registro/perfil` — foto (bucket `flyers`, prefijo `perfiles/`),
  Instagram, TikTok, WhatsApp público (prellenado). Exige el flag
  `verificado` de la cookie. Al enviar crea el `perfiles`, el `access_token`,
  la sesión `envivo_publicador` (cookie firmada HMAC, como el admin) y va a
  `/panel`.
- `/panel` — **placeholder** (Sesión 15). Sin métricas: las del mockup
  (seguidores/vistas/clics) chocan con la línea roja — decidir antes de S15.
- El código lo generan, expiran y limitan del lado de Twilio; EnVivo solo
  hace dos llamadas HTTP a su API (sin SDK). No hay confirmación manual ni
  webhook: se borró `/admin/registro` y `/api/wa/webhook` al cambiar de
  `wa.me` a Twilio Verify.
- Env nuevas: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID` (el servicio de Verify configurado con
  "Code Length = 4"). El WhatsApp Business Manager / Sender de Meta que se
  configuró en Twilio queda sin usar para este flujo.

**Admin (solo yo):**
7. `/admin` — login con teléfono + PIN
8. `/admin/cola` — aprobar, rechazar, fusionar
9. `/admin/cambiar-pin` — cambiar el PIN provisional. Si el login devuelve
   `debeCambiarPin` (columna `must_change_pin`), se redirige aquí antes de la
   cola. Usa la función `cambiar_pin_admin` por API route del servidor.
   (Añadida después del arranque; es la única pantalla extra del admin.)

---

## Reglas del producto

- **Los pines del mapa muestran hora + nombre del evento.** Verde si es gratis.
- El flyer es **obligatorio**. El link de reel/TikTok es **opcional** y su botón solo aparece si existe.
- El WhatsApp es siempre **del local u organizador**, nunca del artista.
- Eventos recurrentes: se generan como **filas reales** (una por fecha), agrupadas por `series_id`. Tope 3 meses.
- Un evento choca solo si coinciden **mismo WhatsApp + mismo lugar + misma hora**. Varios eventos el mismo día en sitios distintos son válidos.
- Todo evento entra como `pendiente`. Yo apruebo desde `/admin/cola`.
- La ubicación se marca con **pin arrastrable**, nunca escribiendo una dirección.

## Diseño

Estética de cartelera de conciertos. Fondo índigo, no negro.

```
--noche:#161A3D  --noche-2:#1F2453  --noche-3:#2A3068
--laton:#FFB627  --cana:#5FD6A0  --coral:#FF5E5B
--hueso:#F4F1E8  --hueso-tenue:#A7A9C4
--linea:rgba(244,241,232,.14)
```

- Tipografía: **Archivo** 700/800 para títulos, horas y botones principales (letter-spacing cerrado, -.02 a -.04em). **Instrument Sans** para cuerpo y datos.
- El latón se usa con avaricia: horas, CTA principal, estado activo. Nada más.
- Verde `--cana` = gratis, en toda la app.
- PWA: color de tema `#161A3D`.
- Referencia visual: los archivos `envivo-pantallas-*.html` que te voy a pasar. Síguelos.

---

## Línea roja

Esto es un MVP. **No construyas nada de esto por tu cuenta**, ni aunque parezca
buena idea o "ya que estamos".

**Prohibido siempre:**

- Perfiles de usuario con avatar, biografía o muro
- Dashboard de métricas o estadísticas
- Notificaciones push del navegador
- Sistema de moods o filtros por estado de ánimo
- Ofertas, reseñas, check-ins, ranking, comentarios
- Venta de boletas de eventos (ticketing)
- Chat interno
- Puja por posición en el mapa (el orden es cronológico y no se toca)

**Planeado, pero NO en el MVP actual** (no lo adelantes; cada cosa se construye
en su sesión del spec — ver "Decisiones fijas"):

- Login con Google para el público — Fase 2, Sesión 14 (seguir publicadores,
  recibir avisos)
- Verificación del publicador por SMS con código de 4 dígitos (Twilio
  Verify) — Fase 2
- Lista de seguidores (privada ≤ 25, pública después) — Fase 2
- Cobro de "pin destacado" y "perfil destacado" — los productos y precios ya
  están decididos; la pasarela de pago va en su propia sesión

Si crees que algo de esto hace falta antes de tiempo, dímelo y lo decido yo.

Al terminar cada sesión de trabajo, revisa que no hayamos agregado nada fuera de este documento.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
