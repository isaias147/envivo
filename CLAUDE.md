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
- **Registro del publicador:** verificación por **DOS canales obligatorios —
  SMS y correo — con código de 4 dígitos vía Twilio Verify**, nunca Google.
  Ambos deben confirmarse para continuar. **Planeado (Fase 2).** Hoy el
  publicador tampoco ve login: el acceso es por link de QR/WhatsApp.
  (Evolución: `wa.me` → solo SMS por Twilio → SMS + correo. El `wa.me` se
  descartó porque el número no se pudo registrar como empresa en Meta.
  Twilio Verify maneja generación, expiración y reintentos; el canal email
  necesita SendGrid conectado al servicio de Verify.)
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
- **Barrera server/cliente:** `lib/supabaseServidor.ts`, `sesionPublicador.ts`, `adminSesion.ts`, `tokenOrganizador.ts` y `registroPublicador.ts` empiezan con `import "server-only";` — si un Client Component los importa (directa o transitivamente), el **build falla**. Lo que sí necesita el cliente de esos módulos (hoy: `TipoPerfil`, `TIPOS_PERFIL`, `esTipoPerfil`) vive en `lib/tiposPerfil.ts`, que no importa nada de servidor. No mover cosas de `tiposPerfil.ts` de vuelta a `registroPublicador.ts`.
- Tabla principal: `events`. Vista pública: `eventos_publicos` (filtra `status = 'aprobado'` y futuros). **Ojo:** todavía **no** filtra `oculto_por_denuncias` — un evento bajado por denuncias sigue saliendo en el mapa y la lista hasta que se agregue `AND e.oculto_por_denuncias = false` a la vista (pendiente, lo decide el dueño).
- `events.reubicado_pendiente` (boolean, default false) — Sesión 13, paso 6: el publicador movió el pin >500 m al editar un evento publicado. Solo bandera; el conteo (`veces_movido`, aviso a las 2 reubicaciones) es de la Sesión 18, que la reemplaza o complementa.
- **Publicación directa + moderación (Sesión 18).** `events.status` nace en `'aprobado'` (default de la base): el evento sale al mapa al instante, sin cola de aprobación. Columnas nuevas en `events`:
  - `aforo` (int) — cuántas personas caben. **Obligatorio** al publicar; lo valida `POST /api/publicador/evento/crear`.
  - `tipo_espacio` (`'abierto'` | `'cerrado'`).
  - `hora_inicio`, `hora_fin` (`time`) — el formulario manda `hora_inicio` = la misma hora de `starts_at`; `hora_fin` es el campo nuevo "Termina".
  - `veces_movido` (int, default 0) y `ultima_ubicacion_pregunta_enviada` (timestamptz) — andamiaje del aviso por reubicaciones repetidas; sin uso todavía.
  - `oculto_por_denuncias` (boolean, default false) — lo pone la ruta de denuncias al pasar el umbral (ver abajo). No hay UI para devolverlo a `false` todavía.
- `reportes` — denuncias del usuario final sobre un evento. Columnas: `event_id` (FK `events`, ON DELETE CASCADE), `user_id` (FK `auth.users`), `motivo` (CHECK: `no_existe` | `info_falsa` | `lugar_equivocado` | `inapropiado` | `otro`), `creado_en`. **UNIQUE (event_id, user_id)**: una persona denuncia un evento una sola vez. RLS: insert y select solo de lo propio (`user_id = auth.uid()`). El conteo total para el umbral se hace con service_role.
- `POST /api/eventos/denunciar { eventId, motivo }` (Sesión 18) — exige el `access_token` del usuario final en `Authorization: Bearer`, lo valida con `getUser()` e inserta en `reportes` COMO el usuario (`upsert` que ignora el duplicado). Después cuenta las denuncias del evento y, si llegan a `max(6, aforo · 0.05)`, pone `events.oculto_por_denuncias = true` con service_role.
- Función de choques: `hay_choque(whatsapp, lat, lng, starts_at)`.
- **WhatsApp del organizador**: se guarda como indicativo de país + dígitos, sin espacios ni símbolos (`573001234567`). El formulario `/publicar/nuevo` tiene un selector de país (`PAISES_WHATSAPP` en `lib/eventos.ts`; Colombia +57 por defecto). Helpers: `componerWhatsapp(indicativo, campo)` (solo el formulario antepone indicativo, con esto), `normalizarWhatsapp()` (solo limpia caracteres, nunca antepone nada — para comparar en panel/tokens/`/mis-eventos`), `formatearWhatsapp()` (para mostrar). Es la clave que une `events.whatsapp`, `access_tokens.whatsapp` y `hay_choque`. El `phone` del admin es otro campo y no se toca.
- Login admin: `verificar_admin(phone, pin)`. Cambio de PIN: `cambiar_pin_admin(phone, pin_actual, pin_nuevo)` (PIN nuevo de 4 dígitos). Ambas solo desde API routes del servidor.
- Vista de duplicados: `posibles_duplicados`.
- Bucket de flyers: `flyers` (público, 3 MB, solo JPG/PNG/WebP).
- Tablas `admins` y `access_tokens`: cerradas al cliente, solo desde servidor.

### Auth del usuario final (Sesión 14 — en construcción)

- **Dos sistemas de sesión que NO se mezclan:** el *publicador* usa la cookie
  HMAC `envivo_publicador` (servidor, `lib/sesionPublicador.ts`); el *usuario
  final* usa **Supabase Auth** (`auth.users`, token en `localStorage`, cliente
  del navegador). El usuario final solo sirve para *seguir* publicadores; no
  publica ni ve panel.
- `lib/authUsuario.ts` — cliente. `entrarConGoogle()` (OAuth con `redirectTo`
  = la URL actual, nunca fija; guarda el scroll en `sessionStorage` para
  restaurarlo al volver, vía `<RestaurarScrollLogin>` en el layout),
  `useUsuario()` (hook), `salir()`.
- `components/ModalEntrarConGoogle.tsx` — hoja inferior (portal a `<body>`),
  patrón del slot 2 de `envivo-grupo1-publico.html`. Página de prueba suelta
  en `/pruebas/entrar` (**temporal**, borrar cuando ya no haga falta).
- **Seguir (Sesión 14, paso 2)** — `components/BotonSeguir.tsx`: sin sesión
  de usuario final abre el modal (y deja marcado el perfil en
  `sessionStorage` para completar el follow al volver); con sesión hace
  `POST /api/seguir { perfilId, accion: "seguir"|"dejar" }`. Optimista +
  `router.refresh()` (así el contador de `/p/[slug]`, Server Component
  `force-dynamic`, se recuenta — recordá que solo se *muestra* con 25+).
  Está en `/p/[slug]` (dentro de `AccionesPerfil`) y en `/evento/[id]`
  (tarjeta "Publicado por"); en ambos sigue al **perfil**, no al evento.
- `POST /api/seguir` — **no confía en el frontend**: exige el `access_token`
  del usuario en `Authorization: Bearer`, lo valida con `getUser()`, y crea
  un cliente Supabase CON ese token, así que la RLS de `seguimientos`
  (`user_id = auth.uid()`) sigue aplicando. `user_id` sale del token, nunca
  del body. `upsert` idempotente al seguir.
- Google OAuth **ya habilitado** en Supabase (`external.google = true`,
  Client ID/Secret puestos). Si al volver del login cae en la home en vez de
  la URL de origen, falta agregar `http://localhost:3000/**` y la URL de
  Netlify en Auth → URL Configuration → Redirect URLs.

### Capa de identidad (Sesión 11 — andamiaje de Fase 2, todavía sin UI)

- `perfiles` — perfil público de EnVivo: `tipo` (`local`/`organizador`/`artista`), `slug`, `nombre`, `celular_cuenta` (el celular verificado por SMS al registrarse — **no es WhatsApp** — **clave privada, no se expone al cliente**, se oculta por privilegios de columna), `whatsapp_publico`, redes, `imagen_url`, `verified_at`, `seguidores_publicos`. RLS: lectura pública; escritura solo servidor (la policy de "dueño" se añade en Sesión 14, cuando exista la auth del publicador).
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

**Barra inferior de tabs** (`components/BarraInferior`, Sesión 14 paso 5):
Mapa `/` · Lista `/lista` · Siguiendo `/siguiendo`. Está en `/`, `/lista`,
`/siguiendo` y `/yo` (en `/yo` sin tab activo). Mapa/Lista conservan los
filtros (`?t=&p=`); Siguiendo no. Badge en Siguiendo = nº de perfiles
seguidos cuyo próximo evento está marcado "Nuevo" (misma `useSeguidos` de
`lib/siguiendo.ts`). El acceso a `/yo` es `components/EnlaceCuenta` (avatar
de Google, arriba a la derecha en `/`, `/lista`, `/siguiendo`).
3. `/evento/[id]` — detalle. Si el evento tiene `perfil_id`, la tarjeta
   "Publicado por" es tocable y lleva a `/p/[slug]` (Sesión 13, paso 2); los
   datos del perfil ya vienen en `eventos_publicos` por LEFT JOIN. Sin
   `perfil_id` (eventos viejos) se muestra el nombre plano de siempre.
   Al final, botón discreto **"Reportar un problema"** (`components/BotonDenunciar`,
   Sesión 18): sin sesión de usuario final abre `ModalEntrarConGoogle`; con
   sesión, hoja inferior con los 5 motivos → `POST /api/eventos/denunciar`.
3b. `/p/[slug]` — perfil público de un local/organizador/artista (Sesión 13,
    paso 1). Server Component: foto, tipo, redes; "Próximos eventos"
    (mini-mapa + lista desde `eventos_publicos` por `perfil_id`) y "Ya
    pasaron" (últimos 10 desde `events`, `status='aprobado'`). Botón
    "Seguir" real desde Sesión 14 paso 2 (`components/BotonSeguir` →
    `/api/seguir`; ver "Auth del usuario final"). El nº de seguidores solo
    se muestra con 25+ (privado por debajo — ver "Decisiones fijas"). Slug
    inexistente → 404.
3c. `/siguiendo` — a quién sigue el usuario final (Sesión 14, paso 3).
    Client Component (sesión de usuario final = Supabase Auth). Sin sesión →
    estado vacío con botón "Entrar con Google" (abre el modal, no salta
    solo). Con sesión: `seguimientos` → `perfiles` → próximo evento futuro
    de cada uno (de `events`, `status='aprobado'`, el más cercano). Los que
    no tienen evento salen igual con "Sin eventos próximos". Badge **"Nuevo"**
    = el próximo evento se publicó (`events.created_at`) en las últimas 72 h
    y después de `user_metadata.ultima_visita_siguiendo` (que se actualiza al
    entrar; sin tabla nueva). Es un tab de la barra inferior. La lógica de
    datos vive en `lib/siguiendo.ts` (`useSeguidos`), compartida con el badge
    de la barra.
3d. `/yo` — cuenta del **usuario final** (Sesión 14, paso 4). Distinta de
    `/perfil` (cuenta del publicador). Client Component. Sin sesión → estado
    vacío + "Entrar con Google". Con sesión: nombre + email de Google
    (`user_metadata.full_name` / `avatar_url`), toggle "Avisos de nuevos
    eventos" (guarda `user_metadata.avisos`, default true; **no hay sistema
    de envío todavía**), "Perfiles que seguís" → `/siguiendo`, "Cerrar
    sesión" (`signOut` → `/`), "Borrar mi cuenta" (confirmación en dos
    pasos → `POST /api/yo/eliminar`). Se llega por `EnlaceCuenta` (arriba a
    la derecha en `/`, `/lista`, `/siguiendo`). No es un tab de la barra.
- `POST /api/yo/eliminar` — `auth.admin.deleteUser` es solo service_role.
  Valida el Bearer token con `getUser()`, borra `seguimientos` del usuario
  (belt-and-suspenders; la FK ya es `ON DELETE CASCADE`) y luego
  `supabaseServidor.auth.admin.deleteUser(user.id)` — el id sale del token.

> Fase 2 (Sesión 14 del spec): login con Google **opcional** para seguir
> publicadores y recibir avisos. No se adelanta; hoy el usuario nunca ve un login.

**Organizador (sin registro, link entregado por QR o WhatsApp):**
4. `/publicar` — el mapa con botón "Publicar evento"
5. `/publicar/nuevo` — el formulario. **Exige sesión de publicador** (cookie
   `envivo_publicador`, leída vía `GET /api/publicador/sesion`); sin ella
   redirige a `/registro`. El evento hereda `perfil_id` + nombre + tipo +
   redes del perfil (esos campos no se piden; encabezado "Publicando como
   [nombre]"). El INSERT pasa por `POST /api/publicador/evento/crear`
   (service_role, impone nombre/tipo/redes desde el perfil). **Sesión 18:**
   el formulario pide además `aforo` (obligatorio), `tipo_espacio`
   (abierto/cerrado) y hora de fin; el evento sale **publicado al instante**
   (`status` = `'aprobado'` por defecto) y la pantalla final ya no dice "lo
   revisamos".
6. `/mis-eventos/[token]` — lo que ha publicado ese WhatsApp, en cuatro
   secciones (En el mapa / En revisión / No publicado / Ya pasaron). Solo
   lectura. (Desde la Sesión 18 los eventos nuevos salen directo a "En el
   mapa"; "En revisión" solo retiene `pendiente`s antiguos. Los eventos con
   `oculto_por_denuncias = true` no tienen sección propia todavía.) El token
   vive en `access_tokens` y se genera (o se reutiliza)
   desde la API route del servidor al aprobar o fusionar el primer evento
   de ese WhatsApp.
   `/mis-eventos` (sin token) tiene dos caras (Sesión 13, paso 4): con
   sesión de publicador (`envivo_publicador`) muestra la misma lista de
   cuatro secciones, trayendo los eventos por `perfil_id` (y por el WhatsApp
   de la cuenta, para los publicados antes de registrarse); sin sesión es la
   pantalla-puente que explica dónde está el link personal. La lista vive en
   `components/MisEventosLista.tsx` (la usa `/mis-eventos`); `[token]`
   conserva su copia propia sin cambios.
6b. `/mis-eventos/editar/[id]` — editar un evento publicado (Sesión 13,
   paso 6). **Solo con sesión de publicador**, y solo eventos de su
   `perfil_id`. Cambia **flyer, video y ubicación**, nada más; se guarda
   directo por `POST /api/publicador/evento/editar` (service_role, verifica
   dueño), **sin re-revisión** (la Sesión 18 quitó la cola de aprobación). Si
   el evento es una serie, el cambio aplica a todas sus fechas. Mover el pin
   >500 m del punto original marca `events.reubicado_pendiente = true` — se
   detecta, no bloquea. Nombre/hora/descripción no se editan aquí. Enlace
   "Editar…" en las tarjetas de "En el mapa" de `/mis-eventos`.
   (Añadida después del arranque; es la única pantalla extra del organizador.)

**Alta del publicador (Sesión 12, revisada — verificación por SMS + correo con Twilio Verify, sin Google):**
- `/registro` — **una sola pantalla** (antes 5a+5b). Tipo de perfil por
  `<select>` (ya no tarjetas). Pide: tipo, nombre del local/marca, **datos
  del administrador** (nombre, apellido, edad), celular de cuenta (con nota
  "solo para verificarte, no tiene que ser el que publiques") y **correo**.
  Al enviar → `/api/registro/iniciar` valida todo y le pide a Twilio Verify
  que mande **los dos códigos** (SMS + email); deja la cookie
  `envivo_registro` con todos los datos (sin `smsOk` / `correoOk` todavía).
- `/registro/verificar` — **dos tarjetas de canal** (SMS, Correo), cada una
  con 4 casillas. `/api/registro/verificar { canal, codigo }` valida contra
  Twilio y re-firma la cookie poniendo `smsOk` o `correoOk`. "Continuar" se
  habilita solo con los dos verificados. "Reenviar" por canal
  (`/api/registro/reenviar { canal }`).
- `/registro/perfil` — foto (bucket `flyers`, prefijo `perfiles/`),
  Instagram, TikTok, WhatsApp público (prellenado). Exige `smsOk && correoOk`
  en la cookie. Al enviar crea el `perfiles` (con `admin_nombre/apellido/edad`,
  `correo_admin`, `correo_verificado = true`), el `access_token`, la sesión
  `envivo_publicador` y va a `/panel`.
- `/panel` — **placeholder** (Sesión 15). Sin métricas: las del mockup
  (seguidores/vistas/clics) chocan con la línea roja — decidir antes de S15.
- `/perfil` — vista **privada** del dueño (Sesión 13). Server Component sin
  params: consulta siempre el perfil de `sesion.perfilId` (por eso nadie ve
  el de otro). Sin sesión → `/registro`. Todavía no enlazado desde `/panel`
  (eso lo decide S15).
  - Paso 5: muestra el número **real** de seguidores, aunque sea < 25 (en
    `/p/[slug]` público sigue oculto por debajo de 25).
  - Paso 7: edita **nombre** (libre) e **Instagram + WhatsApp público** con
    **candado de 30 días** desde `perfiles.ultimo_cambio_contacto`. Bloqueado
    → campos en lectura + "Podés cambiarlo desde el [fecha]". Guarda por
    `POST /api/publicador/perfil/editar` (service_role) que **revalida el
    candado** con el valor de la base, no confía en el frontend; al cambiar
    IG/WA pone `ultimo_cambio_contacto = now()`. Helper `candadoContacto()` +
    `VENTANA_CANDADO_DIAS` en `lib/registroPublicador.ts`. Sigue la pantalla
    8 de `envivo-grupo2-publicador.html`.
- El código lo generan, expiran y limitan del lado de Twilio; EnVivo solo
  hace dos llamadas HTTP a su API (sin SDK). No hay confirmación manual ni
  webhook: se borró `/admin/registro` y `/api/wa/webhook` al cambiar de
  `wa.me` a Twilio Verify.
- Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
  (el servicio de Verify configurado con "Code Length = 4"). **Para el canal
  email hay que conectar SendGrid** al servicio de Verify en la consola de
  Twilio (Email Integration); hasta entonces el código del correo no se
  entrega y el registro no se puede terminar. El Sender de Meta que se
  configuró en Twilio queda sin usar.
- `perfiles`: columnas `admin_nombre`, `admin_apellido`, `admin_edad` (CHECK
  14–120), `correo_admin`, `correo_verificado` (migración
  `envivo_perfiles_admin_y_correo`). Son PII: **sin grant a `anon`/
  `authenticated`**, solo se escriben/leen por service_role.

**Admin (solo yo):**
7. `/admin` — login con teléfono + PIN
8. `/admin/cola` — aprobar, rechazar, fusionar. Desde la Sesión 18 los
   eventos ya no esperan aprobación (nacen `'aprobado'`); la cola queda para
   `pendiente`s antiguos, duplicados y fusiones. La moderación nueva es a
   posteriori, por denuncias (`reportes` + `oculto_por_denuncias`), y todavía
   no tiene pantalla de admin.
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
- **Publicación directa (Sesión 18).** El evento sale al mapa apenas se publica (`status` nace en `'aprobado'`, no hay cola de aprobación previa). La moderación es **a posteriori**, por denuncias: cuando un evento junta `max(6, aforo · 5%)` denuncias en `reportes`, `POST /api/eventos/denunciar` le pone `oculto_por_denuncias = true`.
- Al publicar se piden ahora **aforo** (obligatorio), **tipo de espacio** (abierto/cerrado) y **hora de fin**, además de la hora de inicio.
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
- Ofertas, reseñas, check-ins, ranking, comentarios (la **denuncia** de la
  Sesión 18 no es esto: no es texto público ni puntúa nada, solo marca un
  motivo cerrado para moderación)
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
