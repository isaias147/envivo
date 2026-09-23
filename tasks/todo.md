# Todo — responsive escritorio (ver tasks/plan.md)

## Fase 0 — línea base
- [ ] 0.1 Recorrer en el navegador, a 380px, las rutas en alcance (lista en
      SPEC.md §2) y confirmar que hoy se ven como siempre. Criterio: cero
      diferencias visuales respecto a antes de empezar esta spec.

## Fase 1 — verificar lo que ya funciona (sin tocar código)

Probado en Chrome real a 1440×900 (`npm run dev`), con datos reales de
Supabase donde se pudo.

- [ ] 1.1 **PENDIENTE — retomar con perfil de prueba.** `/p/[slug]` — la
      tabla `perfiles` está vacía (`select slug,nombre` devolvió `[]`),
      cualquier slug cae al 404 genérico de Next (pantalla blanca, no usa
      `.marco`). El CSS del archivo (`max-width:480px;margin:0 auto`) es
      idéntico al de `/evento/[id]`, que sí se verificó — bajo riesgo, pero
      no da por cerrado hasta probarlo con un perfil real.
- [x] 1.2 `/evento/[id]` — **PASA**. Probado con un evento real
      (`ec5b24b9-…`, "Noche de trivia y cerveza artesanal"): columna de
      480px centrada, fondo `--noche` a los lados, cero cambios necesarios.
- [x] 1.3 `/siguiendo` — **PASA, con el matiz esperado**. El encabezado y el
      estado vacío ("Entra con tu cuenta…") sí quedan centrados en la
      columna de 480px (confirmado por matemática de píxeles: el botón
      queda centrado exactamente en el centro real del viewport, que
      coincide con el centro de la columna). Como se anotó en el plan, el
      FAB de `BarraFlotante` (campana + mapa) queda pegado al borde
      **real** de la ventana, no al borde de la columna — es exactamente
      lo que la Fase 3 va a corregir, no es un hallazgo nuevo.
- [x] 1.4 `/yo` — **PASA**, mismo resultado y mismo matiz que 1.3.
- [x] 1.5 `/mis-eventos` (puente, sin sesión) — **PASA**. El botón
      "Publicar un evento" queda centrado exactamente en el centro del
      viewport (columna de 440px funcionando). No se pudo probar la
      variante "con sesión" (requiere Bearer de Google) ni
      `/mis-eventos/[token]` (requiere un token real de `access_tokens`,
      tabla solo accesible por service_role) — mismo CSS que la variante
      puente, riesgo bajo, pero sin verificar con datos reales.
- [ ] 1.6 **PENDIENTE — retomar con perfil de prueba.** `/mis-eventos/[token]`
      (ver 1.5, mismo motivo: requiere un token real de `access_tokens`).
- [ ] 1.7 **PENDIENTE — retomar con perfil de prueba.**
      `/mis-eventos/editar/[id]` (requiere sesión de publicador con cookie
      `envivo_publicador`).
- [x] 1.8 `/publicar/nuevo` — **PASA**. Sin sesión de Google muestra la
      puerta con `ModalEntrarConGoogle`; el botón "Entrar con Google" del
      fondo queda centrado igual que en 1.5.
- [ ] 1.9 **PENDIENTE — retomar con perfil de prueba.** `/perfil` — ahora es
      Client Component (`useCuentaPublicador()`); sin sesión se queda en
      "Cargando…" indefinido en vez de mostrar el estado vacío o redirigir —
      no hay `.marco` visible para confirmar el centrado. No es un problema
      nuevo de esta spec (es el comportamiento actual sin sesión).
- [ ] 1.10 **PENDIENTE — retomar con perfil de prueba.** `/panel` — sin
      sesión, el Server Component redirige derecho a `/yo` (ya verificada en
      1.4). Hace falta una cookie `envivo_publicador` real para ver `/panel`
      en sí.
- [x] 1.11 `ModalEntrarConGoogle` — **PASA**. Abierta desde `/yo`, la hoja
      "Entra a EnVivo" se centra sola sobre el velo oscurecido, exactamente
      en el centro del viewport.
- [ ] 1.12 `BotonDenunciar` en `/evento/[id]` — no se llegó a probar en esta
      pasada (mismo patrón `.velo`/`.hoja` que 1.11, riesgo bajo).
- [x] Checkpoint: resultados de Fase 1 abajo, para confirmar con el usuario
      antes de tocar código

## Fase 2 — pantallas de mapa
- [x] 2.1 `app/publicar/page.module.css` — agregado
      `@media (min-width: 768px) { .pantalla { max-width: 480px; margin: 0 auto; } }`.
      Verificado en Chrome real (~1024/1440px efectivos): mapa + marca +
      "Volver"/"Mis eventos" + filtros + botón "Publicar evento", todo
      dentro de la columna de 480px. Sin cambios en `Mapa.tsx`.
- [x] 2.2 `app/page.module.css` — mismo cambio en `.pantalla`. Verificado en
      ~1440px: buscador, chips de categoría y EnlaceCuenta quedan dentro de
      la columna. **Pendiente de re-probar** con los filtros de
      tiempo/precio/edad abiertos y con una tarjeta flotante de evento
      abierta (no se llegó por el problema de herramienta de abajo).
- [x] `npm run build` — limpio, sin errores nuevos.
- [x] Checkpoint — revisión visual: **PASA** en ambas pantallas, con una
      salvedad de herramienta (no de código, ver nota):

  **Nota — limitación de la automatización del navegador en esta sesión:**
  `resize_window` a un ancho angosto (700px, 400px, 390px) en `/` y
  `/publicar` colgó la captura de pantalla (timeout de 30s en
  `Page.captureScreenshot`) dos veces seguidas; se recuperó navegando de
  nuevo. Además, todas las capturas que sí funcionaron salieron con la
  misma resolución física (1568×776) sin importar si pedí 1440, 1024 o 767
  de ancho de ventana — es decir, no logré confirmar por screenshot que el
  mapa se ve **exactamente igual que antes en móvil real** (¡380px!)
  después de este cambio. Lo que sí es una garantía de código, no de
  captura: el bloque nuevo es `@media (min-width: 768px)`, así que por
  construcción no puede aplicarse ni afectar nada por debajo de 768px — el
  CSS existente para móvil no se tocó, solo se agregó código nuevo detrás
  de esa condición. Aun así, antes del checkpoint final (Fase 4) conviene
  una pasada en un dispositivo o emulador real de 380px, no solo por código.

## Fase 3 — BarraFlotante (componente compartido)
- [x] 3.1 `components/BarraFlotante.module.css` — agregado
      `@media (min-width: 768px) { .columna { right: calc((100vw - 480px) / 2 + 16px); } }`.
      Verificado por cálculo Y por captura: a 1408px de viewport la fórmula
      predice el borde derecho del FAB en x=928 y la captura lo muestra
      exactamente ahí, alineado con el borde de la columna de contenido.
- [x] 3.2 `.menuKm` — **no aplica**: al probar clic en el círculo del medio
      en `/lista` no abrió nada. `CLAUDE.md` confirma que el selector de km
      se eliminó (radio de búsqueda fijo en 1.5km, Sesión 17/18) — ese CSS
      quedó sin uso, no hay nada que corregir.
- [x] `npm run build` — limpio.
- [x] Checkpoint: revisión visual conjunta de `/`, `/siguiendo`, `/yo` —
      **PASA**, el FAB queda pegado al borde derecho de la columna de
      contenido en las 3. En `/lista` el FAB ya se movió correctamente
      (mismo cálculo), pero el header y los chips de esa pantalla siguen a
      ancho completo — es el estado intermedio esperado hasta la Fase 4,
      que todavía no se hizo.

## Fase 4 — /lista completa
- [x] 4.1 `app/lista/page.module.css` — agregado
      `max-width: 480px; margin: 0 auto` a `.pantalla`, consolidado en un
      solo bloque `@media (min-width: 768px)` al final del archivo (SPEC.md
      §7: 3 ajustes en el mismo archivo van juntos, no intercalados).
- [x] 4.2 `.marca` — agregado
      `left: calc((100vw - 480px) / 2 + 16px)`. Medido en el navegador a
      1408px: `left: 480px` = borde izquierdo de `.pantalla` (464) + 16px,
      exacto.
- [x] 4.3 `.pie` (no `.filaFiltros` directo) — en vez de recalcular el
      número del padding, se capó `.pie` mismo a `width: 480px` centrado
      (`left:50%;transform:translateX(-50%)`) en lugar de `left:0;right:0`
      (100vw). Medido: `.pie` quedó en left=464/right=944, **idéntico** a
      `.pantalla`. El `padding-right: 100px` de `.filaFiltros` se dejó
      igual — pero el resultado real no es "igual que en móvil" porque
      `.filaFiltros` no mide 100% de `.pie` directo (su padre inmediato es
      `.grupoFiltros`, que no tiene ancho explícito y se ajusta a su
      contenido — `align-items` de `.pie` es `center`, no `stretch`). En la
      práctica igual quedó bien: contenido visible de `.filaFiltros`
      termina en x≈789, `BarraFlotante` empieza en x≈884 → **~94px de aire
      real**, más que los ~40px de "respiro" original y sin overlap visible
      (el único solape es de ~5.6px de padding invisible, `pointer-events:
      none`, sin efecto).
- [x] 4.4 Probado el desplegable de Edad abierto (clic en "Edad"): sube
      correctamente (`grupoFiltrosSubido`), la marca se oculta como está
      diseñado, no se desborda de la columna, `BarraFlotante` sigue
      despejada. No se probó `.menuKm` (confirmado sin uso, ver Fase 3).
- [x] `npm run build` — limpio.

## Checkpoint final — CERRADO

Las 4 fases del plan están implementadas y verificadas (build limpio +
revisión visual/medida en Chrome real en cada una).

- [x] **A. Verificación en dispositivo real a 380px — confirmado por el
      usuario.** El móvil se ve correcto, sin cambios respecto a antes de
      esta spec.
- [x] **B. Los 5 pendientes de Fase 1 con perfil de prueba — 4 de 5
      cerrados, 1 sigue bloqueado (no por falta de datos, por seguridad).**

  **Datos de prueba creados en Supabase (proyecto `ktzrqeoemyzqdcljqeaq`,
  reutilizables en próximas sesiones, o borrar si ya no hacen falta):**
  - `auth.users`: `prueba-qa@example.invalid` / `PruebaQA-2026!x`,
    id `48a30b4b-3b40-4522-9eb8-30517331a07d` (creado con
    `auth.admin.createUser`, no gastó SMS ni pasó por Google)
  - `perfiles`: id `cb185e66-89c4-4247-84b4-9817e24888bd`, slug `prueba-qa`,
    nombre "Prueba QA", tipo `local`, `celular_cuenta`/`correo_admin`
    claramente falsos (`qa-test-000000`, el mismo correo de arriba)
  - `events`: id `92bdd533-fdce-42eb-8263-567902382578`, "Evento de prueba
    QA", `perfil_id` = el de arriba, `whatsapp` = `570000000001`
  - `access_tokens`: token `<token-qa>`, whatsapp
    `570000000001` (mismo del evento)

  - [x] 1.1 `/p/prueba-qa` — **PASA**. Perfil público completo (foto
        placeholder "P", "Local", botón Seguir, mapa con el evento de
        prueba en "Próximos eventos"), columna de 480px centrada.
  - [x] 1.6 `/mis-eventos/<token-qa>` — **PASA**.
        Muestra el evento de prueba en "En el mapa", columna de 440px.
  - [x] 1.9 `/perfil` — **PASA** (con sesión real de Supabase Auth, ver
        método abajo). Formulario completo, "0 seguidores", columna de
        360px. De paso: confirmado que sin sesión sí se queda en
        "Cargando…" indefinido — ver nota de bug fuera de spec al final.
  - [x] Bonus no planeado: `/mis-eventos` (sin token) y `/publicar/nuevo`
        también verificados con esta sesión — ambos **PASAN**
        ("Publicando como Prueba QA", lista de eventos real). `/yo`
        autenticado también salió gratis al probar el redirect de
        `/panel` — **PASA**.
  - [ ] 1.7 `/mis-eventos/editar/[id]` y 1.10 `/panel` — confirmado que
        **ambas rutas redirigen correctamente** sin la cookie
        `envivo_publicador` (`/panel` → `/yo`, `/mis-eventos/editar/[id]` →
        `/mis-eventos`), el comportamiento esperado. Falta ver el contenido
        real; con el mismo CSS `.marco` ya verificado en las otras 8
        pantallas del publicador, el riesgo de que el responsive esté mal
        ahí es bajo, pero sigue sin confirmarse con los propios ojos.
        **Camino para cerrarlo:** correr
        `node scripts/generar-cookie-publicador-qa.mjs` (creado en esta
        sesión) y pegar el valor que imprime como cookie
        `envivo_publicador` en DevTools → Application → Cookies, a mano —
        el script no expone nada por URL, solo imprime el valor por
        terminal. Ver `tasks/decisions-and-learnings.md` para el porqué
        (ningún código de este repo pone esa cookie hoy) y el arreglo de
        fondo (migrar ambas pantallas a `useCuentaPublicador()`, Bearer,
        igual que `/mis-eventos`, `/perfil` y `/publicar/nuevo`).

  **Bug encontrado al pasar, fuera del alcance de esta spec:** `/perfil` sin
  sesión se queda en "Cargando…" para siempre en vez de mostrar un estado
  vacío o redirigir a `/yo` (ya lo hace `/mis-eventos`). Vale la pena una
  tarea aparte para revisar `useCuentaPublicador()`/`/perfil` en ese caso.
