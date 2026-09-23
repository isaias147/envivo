# Plan — implementación de SPEC.md (responsive escritorio)

Basado en `SPEC.md`. Antes de escribir una sola línea de CSS se auditó el
código real de cada pantalla en alcance (ver hallazgo abajo): el trabajo es
mucho más chico de lo que el SPEC hacía suponer, porque casi todas las
pantallas ya usan el patrón `.pantalla { background: var(--noche) }` +
`.marco { max-width: Npx; margin: 0 auto }`, que **ya produce exactamente
el efecto deseado** (columna centrada, fondo alrededor) sin ningún cambio,
en cualquier ancho de viewport.

## Hallazgo — grafo de dependencias real

No hay dependencias de código entre pantallas (cada `page.module.css` es
independiente), pero sí una dependencia de **componente compartido**:
`components/BarraFlotante.tsx` (la columna de FABs — Mapa/Lista, Edad,
Siguiendo) se usa en `/`, `/lista`, `/siguiendo` y `/yo`. Su CSS
(`.columna { position: fixed; right: 16px }`) está anclado al viewport
real, no a la columna de contenido — es el único componente compartido que
necesita arreglo, y arreglarlo una vez repara las 4 pantallas.

Clasificación real, por archivo:

**Ya correctas, cero cambios de código (verificar y listo):**
`/p/[slug]`, `/evento/[id]`, `/siguiendo`, `/yo`, `/mis-eventos`,
`/mis-eventos/[token]`, `/mis-eventos/editar/[id]`, `/publicar/nuevo`,
`/perfil`, `/panel`, `ModalEntrarConGoogle`, `BotonDenunciar` (sus hojas
inferiores ya centran con `.velo{display:flex;justify-content:center}`
sobre un `.hoja{max-width:440px}`).

**Necesitan un cambio real de CSS:**
- `app/page.module.css` (`/`) — `.pantalla` no tiene `max-width`; todos sus
  hijos son `position: absolute` (relativos a `.pantalla`), así que
  agregarle `max-width:480px;margin:0 auto` a `.pantalla` arregla TODO su
  contenido propio de una vez (buscador, chips, tarjeta flotante, EnlaceCuenta).
- `app/publicar/page.module.css` (`/publicar`) — mismo caso que `/`, más
  simple aún porque no usa `BarraFlotante`.
- `app/lista/page.module.css` (`/lista`) — más delicado: `.pantalla` no
  tiene `max-width`, y a diferencia de `/`, sus overlays (`.marca`, `.pie`)
  son `position: fixed` (viewport real), no `absolute` sobre `.pantalla`.
  `.marca` (`left:16px`) queda pegada al borde real de la pantalla si no se
  corrige. `.pie` (`left:0;right:0` + hijos `justify-content:center`)
  coincide con el centro del viewport real, que sí coincide con el centro
  de la columna — pero su hijo `.filaFiltros` tiene
  `padding-right:100px` reservado para `BarraFlotante`, calculado contra el
  viewport real: hay que revisar que ese padding siga teniendo sentido
  cuando `BarraFlotante` deje de estar pegada al borde real (ver abajo).
- `components/BarraFlotante.module.css` (`.columna`) — pegada al borde
  derecho real del viewport (`position:fixed;right:16px`); a ≥768px debe
  anclarse al borde derecho de la columna de 480px, no al del navegador.

## Fases (de menor a mayor riesgo de romper el diseño móvil actual)

### Fase 0 — Línea base (sin cambios de código)
Confirmar que hoy, sin tocar nada, las pantallas en alcance se ven bien a
380px. Es la foto "antes" contra la que se compara cada fase siguiente.

### Fase 1 — Verificar lo que ya funciona (sin cambios de código)
Un task por pantalla de la lista "ya correctas" de arriba. Cada uno es una
rebanada vertical completa (abrir la ruta real, no solo leer el CSS).

### Fase 2 — Pantallas de mapa, la mitad sin `BarraFlotante`
`/publicar` primero (más simple, sin FABs), después `/` (mismo cambio, más
superficie para revisar porque tiene buscador + filtros + tarjeta flotante
+ EnlaceCuenta encima).

### Fase 3 — `BarraFlotante` (componente compartido)
Se hace después de la Fase 2 porque `/` ya debe estar corregida para
verificar que el FAB se alinea con la columna correcta en esa pantalla; de
paso repara `/siguiendo` y `/yo` (que ya eran correctas en su `.pantalla`,
solo les faltaba esto).

### Fase 4 — `/lista` completa (la más delicada)
Shell (`.pantalla`) + `.marca` + revisar `.filaFiltros`/`padding-right`
contra la `BarraFlotante` ya corregida en la Fase 3. Se deja al final
porque depende de la Fase 3 y tiene más piezas interactuando (menú de km,
desplegable de Edad, animación `grupoFiltrosSubido`).

## Checkpoints
- Después de Fase 1: confirmar con el usuario la lista de pantallas ya
  correctas antes de tocar código (evita "arreglar" algo que no estaba roto).
- Después de Fase 2: `npm run build` + revisión visual de `/` y `/publicar`
  en 380/767/768/1024/1440px antes de seguir.
- Después de Fase 3: revisión visual de las 4 pantallas que usan
  `BarraFlotante` juntas.
- Después de Fase 4: revisión visual completa de `/lista` con cada estado
  (menú de km abierto, desplegable de Edad abierto, filtros subidos) en los
  mismos anchos.
