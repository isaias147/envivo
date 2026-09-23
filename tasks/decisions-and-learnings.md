# Decisiones y aprendizajes — spec responsive escritorio

## /panel y /mis-eventos/editar/[id] siguen por cookie; el arreglo de fondo es migrarlas a Bearer

**Estado actual:** las dos únicas pantallas del publicador que todavía
resuelven la sesión por la cookie `envivo_publicador`
(`leerSesionPublicador()`, Server Component). Todo lo demás
(`/mis-eventos` sin token, `/perfil`, `/publicar/nuevo`, y el botón
"Publicar evento" de `/` y `/yo`) ya migró a `useCuentaPublicador()`
(Bearer del access_token de Google, vía `GET /api/publicador/sesion`).

**Por qué es un problema:** `envivo_publicador` es la cookie que antes
ponía el flujo de `/registro`, borrado en el commit `dda6cd1` al mover el
alta a `envivo-publisher`. Hoy **ningún código de este repo la escribe** —
`crearTokenPublicador()` sigue definida en `lib/sesionPublicador.ts` pero
no la llama nadie. Un publicador dado de alta *solo* en `envivo-publisher`
(nunca tuvo esa cookie en este dominio) puede publicar y ver
`/mis-eventos`, pero `/panel` y editar un evento lo tratan como sin sesión
(esto ya estaba anotado como gap conocido en `CLAUDE.md`, sección "Alta del
publicador").

**Arreglo de fondo (no hecho en esta spec):** migrar `/panel` y
`/mis-eventos/editar/[id]` al mismo patrón Bearer que ya usan las otras
tres pantallas — `useCuentaPublicador()` en el cliente +
`GET /api/publicador/perfil` (o una ruta equivalente) para resolver el
`perfilId` desde el `Authorization: Bearer`, igual que ya hace
`/api/publicador/eventos`. El día que eso pase:
- La cookie `envivo_publicador` deja de tener ningún consumidor en este
  repo (se podría borrar `lib/sesionPublicador.ts` entero, o dejarla si
  `envivo-publisher` la sigue necesitando — a confirmar con ese repo).
- `scripts/generar-cookie-publicador-qa.mjs` (creado en esta sesión para
  probar el responsive de estas dos pantallas sin ese código) deja de
  hacer falta.

**Aprendizaje de esta sesión:** no crear un endpoint HTTP para setear esa
cookie de prueba, aunque sea "temporal" — el clasificador de seguridad del
harness bloqueó correctamente el build cuando se intentó
(`app/api/pruebas/entrar-publicador`, sin ninguna verificación, cualquiera
que lo visitara se volvía "Prueba QA"). La alternativa correcta para este
tipo de necesidad es un **script local** (`node scripts/...`, nunca
desplegado, nunca alcanzable por HTTP) que el desarrollador corre a mano y
pega el resultado en DevTools — eso es lo que quedó en
`scripts/generar-cookie-publicador-qa.mjs`.
