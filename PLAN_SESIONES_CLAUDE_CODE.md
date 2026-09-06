# EnVivo · plan de construcción con Claude Code

9 sesiones. Una por vez. No pases a la siguiente hasta que la anterior funcione.

**Antes de empezar:** copia `CLAUDE.md` y los tres archivos `envivo-pantallas-*.html` a la raíz del proyecto. Claude Code lee el `CLAUDE.md` solo.

---

## Sesión 1 · El esqueleto
*Tiempo estimado: 30–45 min*

> Crea un proyecto Next.js con App Router y TypeScript, configurado como PWA (manifiesto y service worker, color de tema #161A3D). Instala y configura el cliente de Supabase con la anon key en variables de entorno. Carga las fuentes Archivo e Instrument Sans, y define los colores del CLAUDE.md como variables CSS globales. No construyas ninguna pantalla todavía: solo el esqueleto y una página en blanco que confirme que Supabase conecta.

**Funciona cuando:** `npm run dev` abre una página en blanco con el fondo índigo y la consola no muestra errores de Supabase.

---

## Sesión 2 · El mapa
*Tiempo estimado: 1–2 horas. Es la sesión más difícil.*

> Construye la pantalla `/` según el archivo envivo-pantallas-usuario.html. Usa react-leaflet con tiles de OpenStreetMap. Lee los eventos de la vista `eventos_publicos`. Los pines muestran hora y nombre del evento, verdes si `is_free`. Incluye geolocalización del navegador con fallback a Granada, Cali si el permiso se niega, selector de radio 1/3/5 km filtrando por bounding box, y filtros Hoy / Este finde / Próximos. Al tocar un pin, muestra la tarjeta inferior con el flyer, la hora, el nombre, el lugar y el precio.

**Funciona cuando:** ves el mapa, se centra en tu ubicación, y los filtros cambian los pines. Aún no habrá eventos: eso es normal.

---

## Sesión 3 · Lista y detalle
*Tiempo estimado: 45 min*

> Construye `/lista` y `/evento/[id]` siguiendo el mockup. La lista agrupa por fecha y reutiliza el mismo componente de tarjeta del mapa. El detalle muestra el flyer a sangre, la descripción, los datos, y las acciones en este orden: WhatsApp (botón latón, abre wa.me con mensaje prellenado), "Ver el reel" solo si hay `post_url`, y "Cómo llegar" (link geo: a la app de mapas del teléfono). Abajo, el bloque "Publicado por" con Instagram y TikTok.

**Funciona cuando:** puedes navegar mapa → detalle → volver, y los botones abren WhatsApp y la app de mapas.

---

## Sesión 4 · Datos de prueba
*Tiempo estimado: 20 min*

> Créame un script que inserte 8 eventos de prueba en Cali con estado 'aprobado', con coordenadas reales de Granada y San Fernando, variados: unos gratis, unos con cover, dos con `series_id` y uno con `post_url` de Instagram. Sube flyers de prueba al bucket flyers.

**Funciona cuando:** el mapa se ve lleno. Aquí es donde el proyecto empieza a sentirse real.

---

## Sesión 5 · El formulario
*Tiempo estimado: 1,5–2 horas. La segunda más difícil.*

> Construye `/publicar` (el mapa con botón "Publicar evento") y `/publicar/nuevo` (el formulario) según envivo-pantallas-organizador.html. El formulario bifurca desde la primera pregunta entre evento único y recurrente. Incluye mini-mapa con pin arrastrable, subida del flyer al bucket, contador de 200 caracteres en la descripción, campo opcional de reel, y el selector "¿Quién publica?" que cambia la etiqueta del WhatsApp cuando se elige Artista. Al enviar, inserta en `events` con status 'pendiente'. Incluye un campo honeypot invisible.

**Funciona cuando:** publicas un evento de prueba y aparece en Supabase como pendiente, con el flyer subido.

---

## Sesión 6 · Recurrencia y choques
*Tiempo estimado: 1 hora*

> Al enviar un evento recurrente, genera una fila por cada fecha compartiendo `series_id`, con tope de 3 meses. Antes de insertar, llama a la función `hay_choque` de Supabase; si devuelve algo, muestra la hoja inferior del mockup con las opciones "Cambiar solo esa fecha" y "Escoger otro día". Al terminar de publicar, muestra la pantalla de confirmación con el botón "Publicar otro evento".

**Funciona cuando:** un evento semanal de 3 meses crea 13 filas, y publicar dos veces lo mismo dispara el aviso de choque.

---

## Sesión 7 · El panel de admin
*Tiempo estimado: 1,5 horas*

> Construye `/admin` (login con teléfono y PIN, validado en una API route del servidor con la función `verificar_admin` y la service_role key — nunca desde el cliente) y `/admin/cola` según envivo-panel-admin.html. Muestra los pendientes con flyer, datos, mapa en miniatura y las fechas de la serie agrupadas. Botones Aprobar, Rechazar y "Otros de este WhatsApp". Pestaña de duplicados leyendo la vista `posibles_duplicados` con opción de fusionar. Todas las escrituras van por API routes del servidor.

**Funciona cuando:** entras con tu número y PIN, apruebas un evento, y aparece en el mapa público.

---

## Sesión 8 · Mis eventos
*Tiempo estimado: 45 min*

> Al aprobar un evento, genera o reutiliza el token de `access_tokens` para ese WhatsApp. Construye `/mis-eventos/[token]` con las tres secciones del mockup: En el mapa, En revisión, No publicado. Solo lectura.

**Funciona cuando:** el link personal muestra los eventos de ese número con su estado.

---

## Sesión 9 · Publicar en internet
*Tiempo estimado: 30 min*

> Conecta el repo a Netlify con las variables de entorno, y verifica que la PWA se pueda instalar desde el celular. Revisa que la service_role key no esté expuesta en el bundle del cliente.

**Funciona cuando:** abres la URL en tu celular, la instalas en la pantalla de inicio, y funciona.

---

## Hábitos que te van a salvar

1. **Una sesión, una cosa.** Si Claude Code propone hacer dos, pídele que haga una.
2. **Pide que explique antes de ejecutar**, sobre todo con SQL.
3. **Cierra cada sesión con:** "revisa que no hayamos agregado nada fuera del CLAUDE.md".
4. **Haz commit al terminar cada sesión.** Si algo se rompe, vuelves atrás sin drama.
5. **Si algo lleva tres intentos y sigue roto**, para. Dime qué pasa y revisamos el supuesto de fondo.

**Total estimado:** entre 8 y 11 horas de trabajo, repartidas como quieras.
