# EnVivo

PWA de eventos en vivo en Cali. Responde una sola pregunta: **¿qué hay pasando cerca de mí esta noche?**

Habla conmigo en español. Soy principiante: explícame qué vas a hacer antes de ejecutarlo, y no des por hecho que entiendo la terminología.

---

## Stack

- **Next.js** (App Router) como PWA — instalable, con manifiesto y service worker
- **Supabase** — proyecto ya existente, tablas ya creadas (no crear tablas nuevas sin avisarme)
- **react-leaflet + OpenStreetMap** para el mapa (sin API key, sin Google Maps)
- **Netlify** para el deploy
- Móvil primero. Todo se diseña para una pantalla de 380px de ancho.

## Supabase

- URL del proyecto: `https://ktzrqeoemyzqdcljqeaq.supabase.co`
- El frontend usa **solo la anon key**, en variables de entorno.
- La **service_role key NUNCA va en el frontend**. Solo en rutas de servidor (API routes). Si la ves en código de cliente, detente y avísame.
- Tabla principal: `events`. Vista pública: `eventos_publicos` (ya filtra aprobados y futuros).
- Función de choques: `hay_choque(whatsapp, lat, lng, starts_at)`.
- Login admin: `verificar_admin(phone, pin)`. Cambio de PIN: `cambiar_pin_admin(phone, pin_actual, pin_nuevo)` (PIN nuevo de 4 dígitos). Ambas solo desde API routes del servidor.
- Vista de duplicados: `posibles_duplicados`.
- Bucket de flyers: `flyers` (público, 3 MB, solo JPG/PNG/WebP).
- Tablas `admins` y `access_tokens`: cerradas al cliente, solo desde servidor.

---

## Las pantallas

**Usuario (sin registro, nunca ve un login):**
1. `/` — mapa con pines, geolocalización, radio 1/3/5 km, filtro Hoy / Este finde / Próximos
2. `/lista` — los mismos eventos en lista
3. `/evento/[id]` — detalle

**Organizador (sin registro, link entregado por QR o WhatsApp):**
4. `/publicar` — el mapa con botón "Publicar evento"
5. `/publicar/nuevo` — el formulario
6. `/mis-eventos/[token]` — lo que ha publicado ese WhatsApp

**Admin (solo yo):**
7. `/admin` — login con teléfono + PIN
8. `/admin/cola` — aprobar, rechazar, fusionar
9. `/admin/cambiar-pin` — cambiar el PIN provisional. Si el login devuelve
   `debeCambiarPin` (columna `must_change_pin`), se redirige aquí antes de la
   cola. Usa la función `cambiar_pin_admin` por API route del servidor.
   (Añadida después del arranque; es la única pantalla extra sobre las 8.)

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

Esto es un MVP. **No agregues nada de esta lista aunque parezca buena idea:**

- Registro o login de organizadores
- Perfiles de usuario, avatares, seguir, guardar favoritos
- Dashboard de métricas o estadísticas
- Notificaciones push
- Sistema de moods o filtros por estado de ánimo
- Ofertas, reseñas, check-ins, ranking, comentarios
- Venta de boletas o pagos
- Chat interno

Si crees que algo de esto hace falta, dímelo y lo decido yo. No lo construyas por tu cuenta.

Al terminar cada sesión de trabajo, revisa que no hayamos agregado nada fuera de este documento.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
