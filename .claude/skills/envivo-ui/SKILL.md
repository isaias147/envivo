---
name: envivo-ui
description: Sistema visual de EnVivo (Paleta 3a Elegante) — colores, tipografía, logo, componentes y reglas de pantalla. Úsala SIEMPRE que se toque interfaz en envivo o envivo-publisher: estilos, CSS, componentes, pantallas nuevas, rediseños, colores, íconos, modo claro/oscuro, chips de categoría, botones, mapa, barras o el logo. Tiene prioridad sobre cualquier estilo inventado; las skills hig-* dan el criterio de calidad y esta skill da la identidad.
---

# EnVivo UI — Paleta 3a (Elegante)

App de eventos presenciales en Cali. Estilo sobrio de alto contraste: negro puro / gris perla, un solo color fuerte por pantalla. Interfaz en español.

## Orden de autoridad
1. Esta skill (identidad EnVivo) manda sobre colores, tipografía y logo.
2. Skills `hig-*` (Apple HIG) = criterio de jerarquía, espaciado, controles, accesibilidad. Es una PWA que también corre en Android: aplicar el HIG como estándar de calidad, no copiar controles nativos de iOS al pie de la letra.
3. `frontend-design` = evitar resultados genéricos, sin romper 1 y 2.

## Reglas fijas de layout
- Móvil primero. En `min-width: 768px` todo va en una columna centrada de 480px; no se diseñan layouts de escritorio.
- `envivo-publisher` es solo móvil, siempre.
- Nunca inventar colores fuera de los tokens de abajo. Si falta uno, preguntar.

## Reglas de color
- **Coral = acción principal** (botón primario, pestaña activa, filtro seleccionado). Un solo elemento coral fuerte por pantalla.
- **Cian = solo ubicación** (tu posición, radio de búsqueda, botón "mi ubicación"). Nunca decoración.
- **Categorías** = chip con tinte suave de fondo + punto o ícono del color sólido. Nunca círculos llenos.
  Tokens `--cat-*` = las 6 categorías reales de la app (`TIPOS_EVENTO` en `lib/eventos.ts`): musica (Música en vivo), clase (Clase o taller), recreativo, cultural, deportivo, espiritual.
- **Estados** (éxito/advertencia/error) siempre con ícono + texto, nunca solo color. Error y la categoría Espiritual son tonos cercanos: el ícono es obligatorio para distinguirlos.
- Superficies agrupadas (listas dentro de tarjetas redondeadas). Barras translúcidas con desenfoque.
- **Texto sobre coral** = `--sobre-coral` (blanco en ambos modos), nunca `--texto`: en modo claro `--texto` es oscuro.
- **Modo claro/oscuro** = automático por `prefers-color-scheme`, sin interruptor. En claro: tiles `alidade_smooth` (en oscuro `alidade_smooth_dark`), logo `simbolo-color-claro`, `theme-color` `#F5F5F7`. Nada de colores escritos a mano: todo sale de los tokens para que cambie solo.
- **Sombras** = solo `--sombra`, y solo en lo que flota sobre otra cosa (fichas y hojas, desplegables, pines del mapa, botones flotantes). Las superficies apoyadas en el fondo no llevan sombra: las separa `--separador`.

## Tokens (CSS)

```css
:root {
  /* Marca — igual en ambos modos */
  --coral-boton: #DC2A4A;          /* fondo botón primario */
  --sobre-coral: #FFFFFF;          /* texto e íconos sobre --coral-boton */

  /* Modo oscuro (por defecto) */
  --fondo: #000000;
  --superficie: #161618;
  --texto: #F5F5F7;
  --texto-secundario: #9A9AA1;
  --separador: rgba(255,255,255,0.10);
  --barra: rgba(22,22,24,0.72);    /* + backdrop-filter: blur(20px) */
  --sombra: 0 8px 24px rgba(0,0,0,0.35); /* superficies flotantes */
  --coral-texto: #FF4D6A;
  --cian: #32C8E8;

  --cat-musica: #E45BD0;
  --cat-deportivo: #3FBF7F;
  --cat-clase: #E0A33A;
  --cat-cultural: #9B7BF0;
  --cat-recreativo: #5B8CFF;
  --cat-espiritual: #EE8043;
  --tinte-alfa: 0.18;              /* fondo de chip = color de categoría a 18% */

  --exito: #3DDC97;
  --advertencia: #FFC53D;
  --error: #FF6A3D;
}

/* Modo claro: automático, sigue al sistema */
@media (prefers-color-scheme: light) { :root {
  --fondo: #F5F5F7;
  --superficie: #FFFFFF;
  --texto: #1D1D1F;
  --texto-secundario: #6E6E73;
  --separador: rgba(0,0,0,0.08);
  --barra: rgba(250,250,252,0.78); /* + backdrop-filter: blur(20px) */
  --sombra: 0 8px 24px rgba(0,0,0,0.12);
  --coral-texto: #C0233D;         /* ≥ 4.5:1 también sobre su tinte */
  --cian: #096E8C;                /* ≥ 4.5:1 sobre #FFFFFF y --fondo */

  --cat-musica: #B83AA6;
  --cat-deportivo: #1E9A5E;
  --cat-clase: #B87A10;
  --cat-cultural: #7A55E0;
  --cat-recreativo: #2F66E0;
  --cat-espiritual: #D0611F;
  --tinte-alfa: 0.12;

  /* Estados en claro: verificados ≥ 4.5:1 sobre #FFFFFF, --fondo y su
     propio tinte (peor caso ~4.7:1) */
  --exito: #157149;
  --advertencia: #925300;
  --error: #B3360F;
} }
```

## Tipografía
- Interfaz: fuente del sistema — `-apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, "Segoe UI", sans-serif`.
- Títulos grandes: peso 700, `letter-spacing: -0.025em`.
- Logotipo: Plus Jakarta Sans. "Envivo" en 700, "App" en 500 con `--texto-secundario`. `letter-spacing: -0.03em`. Plus Jakarta Sans se usa SOLO en el logotipo.

## Logo
Pin de ubicación con arcos de señal. Archivos en `public/brand/` (se usan como `/brand/<archivo>.svg`):

| Archivo | Uso |
|---|---|
| simbolo-color-oscuro.svg | Fondos oscuros (default de la app) |
| simbolo-color-claro.svg | Fondos claros |
| simbolo-coral-mono-oscuro.svg | Una tinta, fondo oscuro |
| simbolo-coral-mono.svg | Una tinta, fondo claro |
| simbolo-blanco.svg | Sobre coral o fotos |
| simbolo-negro.svg | Impresión a una tinta |

Ícono de app: `simbolo-color-oscuro` sobre `#000000`, esquinas redondeadas estilo iOS.

## Antes de entregar una pantalla
1. ¿Hay más de un elemento coral fuerte? → dejar uno.
2. ¿Aparece cian en algo que no sea ubicación? → quitarlo.
3. ¿Algún estado se comunica solo con color? → agregar ícono + texto.
4. ¿Funciona en modo claro y oscuro con los tokens? → probar ambos.
5. ¿Se ve bien a 380px de ancho y centrada a 480px en pantallas grandes?
