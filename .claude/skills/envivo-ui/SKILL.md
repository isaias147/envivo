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
- **Estados** (éxito/advertencia/error) siempre con ícono + texto, nunca solo color. Error y la categoría Otros son tonos cercanos: el ícono es obligatorio para distinguirlos.
- Superficies agrupadas (listas dentro de tarjetas redondeadas). Barras translúcidas con desenfoque.

## Tokens (CSS)

```css
:root {
  /* Marca — igual en ambos modos */
  --coral-boton: #DC2A4A;          /* fondo botón primario, texto blanco */

  /* Modo oscuro (por defecto) */
  --fondo: #000000;
  --superficie: #161618;
  --texto: #F5F5F7;
  --texto-secundario: #9A9AA1;
  --separador: rgba(255,255,255,0.10);
  --barra: rgba(22,22,24,0.72);    /* + backdrop-filter: blur(20px) */
  --coral-texto: #FF4D6A;
  --cian: #32C8E8;

  --cat-musica: #E45BD0;
  --cat-deportes: #3FBF7F;
  --cat-comida: #E0A33A;
  --cat-cultura: #9B7BF0;
  --cat-noche: #5B8CFF;
  --cat-otros: #EE8043;
  --tinte-alfa: 0.18;              /* fondo de chip = color de categoría a 18% */

  --exito: #3DDC97;
  --advertencia: #FFC53D;
  --error: #FF6A3D;
}

[data-theme="light"] {
  --fondo: #F5F5F7;
  --superficie: #FFFFFF;
  --texto: #1D1D1F;
  --texto-secundario: #6E6E73;
  --separador: rgba(0,0,0,0.08);
  --barra: rgba(250,250,252,0.78); /* + backdrop-filter: blur(20px) */
  --coral-texto: #C8243F;
  --cian: #0A7EA0;

  --cat-musica: #B83AA6;
  --cat-deportes: #1E9A5E;
  --cat-comida: #B87A10;
  --cat-cultura: #7A55E0;
  --cat-noche: #2F66E0;
  --cat-otros: #D0611F;
  --tinte-alfa: 0.12;

  /* Estados en claro: propuestos, verificar contraste ≥ 4.5:1 sobre #FFFFFF */
  --exito: #177A4F;
  --advertencia: #A15C00;
  --error: #D23F12;
}
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
