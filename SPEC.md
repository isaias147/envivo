# SPEC — Versión web responsive (móvil + escritorio)

Estado: propuesto, pendiente de aprobación. No implementar hasta confirmar.

## 1. Objetivo

Hoy EnVivo es "móvil primero, todo a 380px de ancho" (`CLAUDE.md`, sección
Stack). Esta spec agrega soporte de escritorio a las pantallas de **público**
y **publicador**, sin crear un layout nuevo: en pantallas anchas, el mismo
contenido móvil se centra con márgenes alrededor, y el mapa (única pantalla
de borde a borde) mantiene el fondo a pantalla completa pero centra sus
controles flotantes en una columna de ancho fijo.

No se toca ninguna de las "Decisiones fijas" del proyecto (una sola PWA con
dos entradas por rol, mapa Stadia oscuro, sin registro de publicador en este
repo, etc.). Esto es una capa de CSS encima de las pantallas que ya existen,
no una pantalla ni un flujo nuevo.

## 2. Alcance

**Dentro de esta spec** (rutas que hoy son solo-móvil y pasan a responsive):

- Público: `/`, `/lista`, `/evento/[id]`, `/p/[slug]`, `/siguiendo`, `/yo`
- Publicador: `/publicar`, `/publicar/nuevo`, `/mis-eventos`,
  `/mis-eventos/[token]`, `/mis-eventos/editar/[id]`, `/perfil`, `/panel`
- Componentes compartidos que aparecen en esas rutas: `BarraInferior`,
  `EnlaceCuenta`, `ModalEntrarConGoogle`, `BotonDenunciar`, `BotonSeguir`,
  `TarjetaEvento`, `TarjetaLugar`, `Buscador`, `FiltroEdad`, `FiltroTipos`,
  `MisEventosLista`

**Fuera de alcance** (quedan solo-móvil, no se tocan en esta ronda):

- `/admin`, `/admin/cola`, `/admin/cambiar-pin` — `admin/cola` ya tiene su
  propio media query (`max-width: 700px`) y `max-width: 1120px`; se deja
  como está, no se homologa a esta spec todavía.
- Cualquier componente que solo aparece en `/admin/*`

## 3. Enfoque visual (decisión ya tomada con el dueño del producto)

**Layout móvil centrado con márgenes**, no un layout de escritorio distinto:

- El contenido conserva el `max-width` de columna que ya tiene cada pantalla
  hoy (360–480px según el caso, ver tabla abajo) y se centra
  horizontalmente; alrededor queda el fondo `--noche`.
- No hay reflow de escritorio (sin paneles lado a lado, sin sidebar de
  filtros, sin grid de tarjetas). Es el mismo diseño de 380px, respirando en
  una pantalla grande.
- **`/` y `/publicar` (el mapa) — resuelto:** a los 1440px, el mapa **no**
  ocupa el ancho completo del viewport con espacio muerto solo alrededor de
  los controles. Sigue la misma regla que todo lo demás: la pantalla entera
  (mapa incluido) se contiene en una columna centrada de **480px**, con el
  fondo `--noche` llenando el espacio muerto a los dos lados. Un mapa de
  borde a borde con controles angostos flotando en el medio sería, en los
  hechos, un layout de escritorio propio para esa sola pantalla — justo lo
  que se descartó en la sección 3. `components/Mapa.tsx` no necesita ningún
  cambio: ya llama `map.invalidateSize()` en un `useEffect` de resize
  (línea ~248), así que Leaflet se recalcula solo sin importar el ancho de
  su contenedor. El único cambio es en `app/page.module.css`: el
  `<div>` que hoy es `position: relative; height: 100dvh` (línea 5) pasa a
  tener `max-width: 480px; margin: 0 auto` dentro del breakpoint de
  escritorio, igual que cualquier otra pantalla — y los controles flotantes
  que hoy usan `left: 16px; right: 16px` dejan de necesitar cambios propios,
  porque ya quedan dentro de esa columna de 480px por herencia.

## 4. Breakpoint

Un solo breakpoint: **`min-width: 768px`** = "escritorio" para efectos de
esta spec (tablet vertical para arriba). Se eligió por ser el umbral que ya
usa `app/admin/cola/page.module.css` (`max-width: 700px` para "no
escritorio"), así queda consistente con el único precedente que existe en el
repo. No se introduce una librería de breakpoints ni una variable CSS
compartida (`custom-media`) — el proyecto no usa PostCSS custom media hoy;
si el número `768px` se repite en más de 3–4 archivos y empieza a doler,
se evalúa extraerlo entonces, no antes.

## 5. Comandos

Sin comandos nuevos. Se usan los que ya existen en `package.json`:

- `npm run dev` — probar cada pantalla en el navegador a 380px, 768px,
  1024px y 1440px (usar las DevTools de Chrome, "Toggle device toolbar" +
  modo responsive)
- `npm run build` — el build de Next.js ya falla si un Client Component
  importa un módulo `server-only` (barrera server/cliente); esta spec no
  toca esa barrera, así que no debería agregar nuevos fallos de build
- `npm run lint`

## 6. Estructura del proyecto

Sin archivos ni carpetas nuevas. Cada pantalla ya tiene su propio
`page.module.css` (CSS Modules, patrón existente); los cambios de esta spec
son `@media (min-width: 768px) { ... }` agregados **al final** de cada
`page.module.css` afectado, más los mismos bloques en los `.module.css` de
los componentes compartidos listados en la sección 2.

Tabla de referencia (ancho de columna móvil actual, que se conserva y
centra en escritorio):

| Ruta / componente | `max-width` actual |
|---|---|
| `/p/[slug]`, `/siguiendo`, `/yo`, `/evento/[id]` | 480px |
| `/publicar/nuevo`, `/mis-eventos`, `/mis-eventos/[token]`, `/mis-eventos/editar/[id]`, `ModalEntrarConGoogle`, `BotonDenunciar` | 440px |
| `/perfil`, `/panel` | 360px |
| `/`, `/publicar` (pantalla completa, mapa incluido) | 480px (nuevo, ver sección 3) |

## 7. Estilo de código

- Sigue el patrón ya establecido: variables de `app/globals.css`
  (`--noche`, `--laton`, `--cana`, `--hueso`, `--cristal-*`, etc.), nunca
  colores nuevos hardcodeados.
- `composes: cristal from global` para superficies, como ya hacen los
  módulos existentes — no se reinventa el efecto cristal para escritorio.
- Sin librería de UI ni de grid nueva (nada de Tailwind, styled-components,
  CSS-in-JS). Solo CSS Modules + media queries, que es lo que ya usa todo el
  repo.
- Un solo breakpoint por archivo cuando sea posible; si una pantalla
  necesita más de un ajuste de escritorio, van todos dentro del mismo bloque
  `@media (min-width: 768px)` al final del archivo, no intercalados.

## 8. Estrategia de pruebas

Sin suite de pruebas automatizadas nueva — esto es CSS de presentación, no
lógica (ver Ponytail: lo trivial no necesita test). Verificación manual en
navegador para cada pantalla de la sección 2, en este orden:

1. 380px — **debe verse pixel-idéntico a hoy** (esto es lo que más se puede
   romper: es la regresión #1 a vigilar)
2. 767px — un pixel antes del breakpoint, sigue viéndose como móvil
3. 768px — el breakpoint entra, el contenido se centra
4. 1024px y 1440px — la columna se mantiene centrada, no se deforma ni se
   estira

Si alguna pantalla usa un componente con estado (`ModalEntrarConGoogle`,
`Buscador` con resultados abiertos, la tarjeta flotante del mapa), probar
también con ese estado abierto en escritorio, no solo el estado vacío.

## 9. Límites (boundaries)

**Siempre:**
- El layout de 380px se mantiene pixel-idéntico; todo cambio es aditivo
  dentro de `@media (min-width: 768px)`, nunca se edita el CSS base sin
  media query.
- Reusar tokens y clases existentes (`globals.css`, `.cristal`).
- Mantener la barrera server/cliente y el modelo de una sola PWA con dos
  entradas por rol — esta spec no crea pantallas ni rutas nuevas.

**Preguntar primero:**
- Cualquier cambio a `app/admin/cola/page.module.css` (ya tiene su propio
  responsive, fuera de alcance) si en el camino se detecta que convendría
  homologarlo.
- Cualquier ajuste a `components/Mapa.tsx` más allá de leer sus dimensiones
  — el mapa en sí (tiles, zoom, encuadre) no se toca en esta spec.
- Si alguna pantalla del alcance no tiene hoy un `max-width` claro (por
  ejemplo si aparece un caso no listado en la tabla de la sección 6).

**Nunca:**
- Tocar `/admin`, `/admin/cola`, `/admin/cambiar-pin` en esta spec.
- Agregar una librería de CSS/UI/grid nueva o una dependencia nueva en
  `package.json`.
- Cambiar el proveedor de mapas, el modo oscuro, o `NEXT_PUBLIC_STADIA_API_KEY`.
- Tocar `lib/supabaseServidor.ts` ni ninguna consulta a Supabase — esto es
  puramente visual.
- Adelantar Fase 2 (login público, seguidores) aprovechando el cambio de
  CSS.
