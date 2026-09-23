// ===== EnVivo · lógica de eventos =====
// Aquí no hay pantallas: solo tipos y funciones puras que usan
// el mapa y (más adelante) la lista y el detalle.

/** Una fila de la vista pública `eventos_publicos` de Supabase. */
export type EventoPublico = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  flyer_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  latitude: number;
  longitude: number;
  starts_at: string; // ISO con zona (timestamptz)
  ends_at: string | null;
  is_free: boolean;
  price_label: string | null;
  whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  post_url: string | null;
  sitio_web: string | null;
  ticket_url: string | null;
  publisher_type: string | null;
  publisher_name: string | null;
  artist_name: string | null;
  artist_instagram: string | null;
  series_id: string | null;
  es_serie: boolean;
  // Perfil asociado (LEFT JOIN a `perfiles` por `events.perfil_id`). Todo
  // null en eventos viejos sin migrar; conviven con `publisher_*`.
  perfil_id: string | null;
  perfil_slug: string | null;
  perfil_nombre: string | null;
  perfil_tipo: string | null;
  perfil_imagen_url: string | null;
  perfil_verificado: boolean;
  perfil_seguidores_publicos: boolean;
  restriccion_edad: "todo_publico" | "infantil" | "mas_12" | "mas_16" | "mas_18";
  pet_friendly: boolean | null;
};

export type Filtro = "hoy" | "finde" | "proximos" | "fechas";

/** Filtro de precio. Se combina con el de tiempo. "todo" no filtra nada. */
export type Precio = "todo" | "gratis" | "cover";

/** ¿el evento pasa el filtro de precio elegido? */
export function pasaPrecio(ev: { is_free: boolean }, precio: Precio): boolean {
  if (precio === "gratis") return ev.is_free;
  if (precio === "cover") return !ev.is_free;
  return true;
}

/**
 * Filtro de edad (FAB propio, separado del grupo Todo/Gratis/Cover). Usa
 * `events.restriccion_edad`, que ya existe — no es un campo nuevo. Cada
 * opción filtra por su valor exacto, sin agrupar ("publico" = solo
 * "todo_publico"; "infantil" es independiente). "todo" no filtra nada
 * (default).
 */
export type FiltroEdad =
  | "todo"
  | "publico"
  | "infantil"
  | "mas_12"
  | "mas_16"
  | "mas_18";

export function leerEdad(v: string | null | undefined): FiltroEdad {
  return v === "publico" ||
    v === "infantil" ||
    v === "mas_12" ||
    v === "mas_16" ||
    v === "mas_18"
    ? v
    : "todo";
}

/** ¿el evento pasa el filtro de edad elegido? */
export function pasaFiltroEdad(
  ev: { restriccion_edad: EventoPublico["restriccion_edad"] },
  edad: FiltroEdad,
): boolean {
  if (edad === "todo") return true;
  if (edad === "publico") return ev.restriccion_edad === "todo_publico";
  return ev.restriccion_edad === edad;
}

// --- Conservar los filtros al pasar de /mapa a /lista y viceversa --------
// Van en la query (`?t=finde&p=gratis`); se omite lo que esté en su valor
// por defecto para que la URL quede limpia mientras no se toque nada.

export function leerFiltro(v: string | null | undefined): Filtro {
  return v === "hoy" || v === "finde" || v === "fechas" ? v : "proximos";
}

export function leerPrecio(v: string | null | undefined): Precio {
  return v === "gratis" || v === "cover" ? v : "todo";
}

/**
 * Categorías de evento (`events.type`). Mismos valores que ofrece el
 * formulario de publicar (`TIPOS` en app/publicar/nuevo/page.tsx) — si se
 * agrega una categoría nueva ahí, hay que sumarla acá también para que el
 * filtro la reconozca.
 */
export const TIPOS_EVENTO: { valor: string; etiqueta: string }[] = [
  { valor: "musica_en_vivo", etiqueta: "Música en vivo" },
  { valor: "clase_taller", etiqueta: "Clase o taller" },
  { valor: "recreativo", etiqueta: "Recreativo" },
  { valor: "cultural", etiqueta: "Cultural" },
  { valor: "deportivo", etiqueta: "Deportivo" },
  { valor: "espiritual", etiqueta: "Espiritual" },
];

const VALORES_TIPO = new Set(TIPOS_EVENTO.map((t) => t.valor));

/**
 * Filtro de categorías (chips bajo el buscador). Selección múltiple;
 * lista vacía = "todas" (default, no filtra nada).
 */
export function leerTipos(v: string | null | undefined): string[] {
  if (!v) return [];
  return [...new Set(v.split(","))].filter((t) => VALORES_TIPO.has(t));
}

/** ¿el evento pasa el filtro de categorías elegido? */
export function pasaTipos(ev: { type: string | null }, tipos: string[]): boolean {
  if (tipos.length === 0) return true;
  return ev.type != null && tipos.includes(ev.type);
}

export function queryFiltros(
  filtro: Filtro,
  precio: Precio,
  edad: FiltroEdad,
  radioKm?: RadioKm,
  centro?: { lat: number; lng: number },
  tipos?: string[],
  fechas?: Fechas,
): string {
  const p = new URLSearchParams();
  if (filtro !== "proximos") p.set("t", filtro);
  if (filtro === "fechas" && fechas) {
    if (fechas.desde) p.set("fd", escribirFecha(fechas.desde));
    if (fechas.hasta) p.set("fh", escribirFecha(fechas.hasta));
  }
  if (precio !== "todo") p.set("p", precio);
  if (edad !== "todo") p.set("ed", edad);
  // El radio se comparte entre / y /lista por la URL; el default
  // (RADIO_INICIAL_KM) se omite.
  if (radioKm && radioKm !== RADIO_INICIAL_KM) p.set("km", String(radioKm));
  if (centro) {
    p.set("lat", centro.lat.toFixed(4));
    p.set("lng", centro.lng.toFixed(4));
  }
  if (tipos && tipos.length > 0) p.set("tipos", tipos.join(","));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Lee el punto de referencia (`?lat=&lng=`) de la URL, para que el mapa y
 * la lista arranquen del mismo lugar al pasar de uno a otro. `null` si no
 * viene o no es un par de números válido — cada pantalla decide su propio
 * fallback (GRANADA_CALI en la lista, gps/Granada en el mapa).
 */
export function leerCentro(sp: {
  get(key: string): string | null;
}): { lat: number; lng: number } | null {
  const latStr = sp.get("lat");
  const lngStr = sp.get("lng");
  if (latStr == null || lngStr == null) return null;
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Barrio Granada, Cali. Fallback cuando el navegador niega la ubicación. */
export const GRANADA_CALI = { lat: 3.4566, lng: -76.5335 };

/**
 * Radio de búsqueda en km, compartido por el mapa (/) y la lista (/lista)
 * vía `?km=`. Se elige con components/SelectorRadio: de RADIO_MIN_KM a
 * RADIO_MAX_KM en pasos de RADIO_PASO_KM. Arranca en RADIO_INICIAL_KM.
 */
export type RadioKm = number;
export const RADIO_MIN_KM = 1.5;
export const RADIO_MAX_KM = 7;
export const RADIO_PASO_KM = 0.5;
export const RADIO_INICIAL_KM = 1.5;

/** Lee `?km=`; cualquier cosa fuera del rango o del paso cae al inicial. */
export function leerRadio(v: string | null | undefined): RadioKm {
  const n = Number(v);
  const valido =
    v != null &&
    n >= RADIO_MIN_KM &&
    n <= RADIO_MAX_KM &&
    Number.isInteger((n - RADIO_MIN_KM) / RADIO_PASO_KM);
  return valido ? n : RADIO_INICIAL_KM;
}

/** "1,5 km" / "3 km": 1 decimal (coma, es-CO) bajo los 10 km, entero desde ahí. */
export function formatoKm(km: number, decimalesSiempre = false): string {
  const r = Math.round(km * 10) / 10; // así 9,96 → "10 km", no "10,0 km"
  const dec = r < 10 && (decimalesSiempre || !Number.isInteger(r)) ? 1 : 0;
  return `${r.toLocaleString("es-CO", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })} km`;
}

/** Nombre legible de la categoría ("musica_en_vivo" → "Música en vivo"). */
export function etiquetaTipo(valor: string): string {
  return TIPOS_EVENTO.find((t) => t.valor === valor)?.etiqueta ?? valor;
}

// Colombia no tiene horario de verano: siempre UTC−5.
const OFFSET_CALI = "-05:00";

/** Año-mes-día y día de la semana (0 = domingo) en hora de Cali. */
function fechaCali(instante: Date): { ymd: string; dow: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instante);

  const buscar = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dias: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    ymd: `${buscar("year")}-${buscar("month")}-${buscar("day")}`,
    dow: dias[buscar("weekday")] ?? 0,
  };
}

/** "YYYY-MM-DD" de hoy en hora de Cali. Para agrupar vistas por día. */
export function hoyCali(ahora: Date = new Date()): string {
  return fechaCali(ahora).ymd;
}

/** Construye un instante a partir de una fecha y hora de pared en Cali. */
function instanteCali(ymd: string, hms: string): Date {
  return new Date(`${ymd}T${hms}${OFFSET_CALI}`);
}

/** Suma (o resta) días a un "YYYY-MM-DD" sin liarse con zonas horarias. */
function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00${OFFSET_CALI}`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Traduce el filtro elegido a un rango [desde, hasta].
 * `hasta` es null en "Próximos" (sin tope).
 * Se deja 3 horas de gracia hacia atrás para que un evento que ya
 * arrancó siga apareciendo un rato.
 */
export function rangoFiltro(
  filtro: Filtro,
  ahora: Date = new Date(),
  fechas?: Fechas,
): { desde: Date; hasta: Date | null } {
  const desde = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  const { ymd, dow } = fechaCali(ahora);

  // "Fechas": el rango elegido (hora de Cali). Si está incompleto o es
  // inválido, no filtra (igual que "Próximos") hasta que se corrija.
  if (filtro === "fechas") {
    const r = fechas ? rangoFechas(fechas) : null;
    if (r) return { desde: r.desde > desde ? r.desde : desde, hasta: r.hasta };
  }

  if (filtro === "hoy") {
    return { desde, hasta: instanteCali(ymd, "23:59:59") };
  }

  if (filtro === "finde") {
    // Viernes 18:00 → domingo 23:59 de la semana actual.
    let ymdViernes: string;
    if (dow === 6) ymdViernes = sumarDias(ymd, -1); // sábado
    else if (dow === 0) ymdViernes = sumarDias(ymd, -2); // domingo
    else ymdViernes = sumarDias(ymd, (5 - dow + 7) % 7); // lun–vie

    const inicioFinde = instanteCali(ymdViernes, "18:00:00");
    const finFinde = instanteCali(sumarDias(ymdViernes, 2), "23:59:59");
    return {
      desde: desde > inicioFinde ? desde : inicioFinde,
      hasta: finFinde,
    };
  }

  return { desde, hasta: null }; // "proximos"
}

/**
 * ¿El evento cae dentro del recuadro (bounding box) de lado 2·radio
 * centrado en `centro`? Es un cuadrado, no un círculo: más barato y
 * suficiente para "cerca de mí".
 */
export function dentroDeCaja(
  ev: { latitude: number; longitude: number },
  centro: { lat: number; lng: number },
  radioKm: number,
): boolean {
  const latDelta = radioKm / 111.32;
  const lngDelta =
    radioKm / (111.32 * Math.cos((centro.lat * Math.PI) / 180));
  return (
    Math.abs(ev.latitude - centro.lat) <= latDelta &&
    Math.abs(ev.longitude - centro.lng) <= lngDelta
  );
}

/** Umbral de "reubicación": mover el pin más de esto al editar se marca. */
export const REUBICACION_METROS = 500;

/**
 * Distancia en metros entre dos puntos (haversine). Se usa al editar un
 * evento para detectar si el pin se movió lo bastante como para marcar
 * `reubicado_pendiente`.
 */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // radio de la Tierra en metros
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Parte la hora de inicio en "9:00" + "pm", en hora de Cali. */
export function horaCali(iso: string): { hhmm: string; periodo: string } {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));

  const buscar = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const periodo = buscar("dayPeriod").replace(/[^a-zA-Z]/g, "").toLowerCase();
  return { hhmm: `${buscar("hour")}:${buscar("minute") || "00"}`, periodo };
}

/**
 * Fecha larga en hora de Cali para los encabezados de la lista y el
 * detalle: "Sábado, 5 de septiembre". Sirve además como clave de grupo
 * (dos días distintos nunca producen el mismo texto dentro del tope de
 * 3 meses de la app).
 */
export function fechaLargaCali(iso: string): string {
  const texto = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Fecha corta en hora de Cali para tarjetas y renglones compactos:
 * "Jue 17 sep".
 */
export function fechaCorta(iso: string): string {
  const texto = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
  return texto.replace(".", "").replace(/(^\w)/, (c) => c.toUpperCase());
}

/** Quita un "@" inicial de un usuario de Instagram o TikTok. */
export function sinArroba(usuario: string): string {
  return usuario.replace(/^@+/, "").trim();
}

/**
 * Países admitidos para el WhatsApp del organizador, con su indicativo
 * telefónico (sin "+"). En orden alfabético (así se muestra el selector);
 * el valor por defecto es `PAIS_WHATSAPP_POR_DEFECTO`, no el primero.
 */
export const PAISES_WHATSAPP = [
  { nombre: "Argentina", indicativo: "54" },
  { nombre: "Bolivia", indicativo: "591" },
  { nombre: "Chile", indicativo: "56" },
  { nombre: "Colombia", indicativo: "57" },
  { nombre: "Costa Rica", indicativo: "506" },
  { nombre: "Ecuador", indicativo: "593" },
  { nombre: "El Salvador", indicativo: "503" },
  { nombre: "España", indicativo: "34" },
  { nombre: "Estados Unidos", indicativo: "1" },
  { nombre: "Guatemala", indicativo: "502" },
  { nombre: "Honduras", indicativo: "504" },
  { nombre: "México", indicativo: "52" },
  { nombre: "Nicaragua", indicativo: "505" },
  { nombre: "Panamá", indicativo: "507" },
  { nombre: "Paraguay", indicativo: "595" },
  { nombre: "Perú", indicativo: "51" },
  { nombre: "Puerto Rico", indicativo: "1" },
  { nombre: "República Dominicana", indicativo: "1" },
  { nombre: "Uruguay", indicativo: "598" },
  { nombre: "Venezuela", indicativo: "58" },
] as const;

/** Indicativo preseleccionado en el formulario: Colombia. */
export const PAIS_WHATSAPP_POR_DEFECTO = "57";

// Indicativos con los más largos primero, para que "593" gane a "5" al
// detectar el prefijo de un número guardado.
const INDICATIVOS = PAISES_WHATSAPP.map((p) => p.indicativo).sort(
  (a, b) => b.length - a.length,
);

/**
 * Limpia un WhatsApp: deja **solo los dígitos**. Nunca antepone un
 * indicativo (de eso se encarga el selector de país del formulario). "" si
 * no hay dígitos. Se usa para comparar de forma estable en el panel de
 * admin, los tokens y /mis-eventos.
 */
export function normalizarWhatsapp(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Une el indicativo elegido en el selector con lo que se escribió en el
 * campo, y devuelve "indicativo + dígitos" sin espacios ni símbolos. Si el
 * campo ya trae el indicativo delante (número internacional pegado entero),
 * no lo duplica.
 */
export function componerWhatsapp(
  indicativo: string,
  campo: string | null | undefined,
): string {
  const d = normalizarWhatsapp(campo);
  if (!d) return "";
  return d.startsWith(indicativo) ? d : `${indicativo}${d}`;
}

/**
 * "573002917326" → { indicativo: "57", nacional: "3002917326" }. Al revés de
 * `componerWhatsapp`: separa un número guardado para rellenar el selector de
 * país + el campo nacional de un formulario. Si no reconoce ningún
 * indicativo, devuelve el país por defecto y los dígitos tal cual.
 */
export function partirWhatsapp(valor: string | null | undefined): {
  indicativo: string;
  nacional: string;
} {
  const d = normalizarWhatsapp(valor);
  const inds = [...new Set(PAISES_WHATSAPP.map((p) => p.indicativo))].sort(
    (a, b) => b.length - a.length,
  );
  for (const ind of inds) {
    if (d.startsWith(ind) && d.length - ind.length >= 6) {
      return { indicativo: ind, nacional: d.slice(ind.length) };
    }
  }
  return { indicativo: PAIS_WHATSAPP_POR_DEFECTO, nacional: d };
}

/**
 * "573001234567" → "+57 300 123 4567" para mostrarlo a una persona. Detecta
 * el indicativo por el prefijo; si no reconoce ninguno, devuelve "+" y los
 * dígitos.
 */
export function formatearWhatsapp(valor: string | null | undefined): string {
  const d = normalizarWhatsapp(valor);
  if (!d) return "";
  const ind = INDICATIVOS.find((i) => d.startsWith(i) && d.length > i.length);
  if (!ind) return `+${d}`;
  const resto = d.slice(ind.length).replace(/(\d{3})(?=\d)/g, "$1 ");
  return `+${ind} ${resto}`;
}

/**
 * Enlace de WhatsApp con el mensaje ya escrito. El número es el del
 * local u organizador (nunca el del artista).
 */
export function enlaceWhatsapp(numero: string, titulo: string): string {
  const texto = `Hola, vi "${titulo}" en EnVivo y quiero preguntar por el evento.`;
  return `https://wa.me/${normalizarWhatsapp(numero)}?text=${encodeURIComponent(texto)}`;
}

/**
 * Enlace de direcciones de Google Maps hacia el punto del evento. Abre la
 * app de Google Maps si está instalada, o el navegador si no, y siempre en
 * modo "cómo llegar".
 */
export function enlaceComoLlegar(lat: number, lng: number): string {
  const destino = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
}

// ---------------------------------------------------------------------------
// Filtro "Fechas" (hoja de filtros): Desde / Hasta con día, mes y año.
// El día es opcional: sin día, "Desde" arranca el 1 del mes y "Hasta"
// termina el último día del mes. Sin "Hasta", se usa el mismo periodo que
// "Desde" (ese día, o ese mes entero). Todo en hora de Cali.
// Los eventos recurrentes son filas reales (una por fecha): cada fecha de
// la serie que cae en el rango aparece sola, sin lógica extra.
// ---------------------------------------------------------------------------

/** Mes de 1 a 12; `dia` null = el mes completo. */
export type FechaParcial = { anio: number; mes: number; dia: number | null };
export type Fechas = { desde: FechaParcial | null; hasta: FechaParcial | null };
export const FECHAS_VACIAS: Fechas = { desde: null, hasta: null };

const dos = (n: number) => String(n).padStart(2, "0");
const diasDelMes = (anio: number, mes: number) =>
  new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** "2026-10" (mes completo) o "2026-10-03". */
export function escribirFecha(f: FechaParcial): string {
  return f.dia == null ? `${f.anio}-${dos(f.mes)}` : `${f.anio}-${dos(f.mes)}-${dos(f.dia)}`;
}

/** Lee "2026-10" o "2026-10-03" de la URL; null si no tiene esa forma. */
export function leerFecha(v: string | null | undefined): FechaParcial | null {
  const m = v?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { anio: Number(m[1]), mes, dia: m[3] ? Number(m[3]) : null };
}

export function leerFechas(sp: { get(key: string): string | null }): Fechas {
  return { desde: leerFecha(sp.get("fd")), hasta: leerFecha(sp.get("fh")) };
}

/** Año actual en Cali y el siguiente: las opciones del desplegable de año. */
export function aniosFiltro(ahora: Date = new Date()): number[] {
  const anio = Number(fechaCali(ahora).ymd.slice(0, 4));
  return [anio, anio + 1];
}

/**
 * Qué impide aplicar el rango, en texto para la persona (se muestra con un
 * ícono), o null si el rango es válido.
 */
export function errorFechas(f: Fechas): string | null {
  if (!f.desde) return "Elige al menos el mes y el año de “Desde”.";
  for (const [etiqueta, x] of [["Desde", f.desde], ["Hasta", f.hasta]] as const) {
    if (x && x.dia != null && x.dia > diasDelMes(x.anio, x.mes)) {
      return `“${etiqueta}”: ese mes no tiene día ${x.dia}.`;
    }
  }
  const r = rangoSinValidar(f.desde, f.hasta ?? f.desde);
  if (r.hasta < r.desde) return "“Hasta” es anterior a “Desde”.";
  return null;
}

function rangoSinValidar(d: FechaParcial, h: FechaParcial): { desde: Date; hasta: Date } {
  const ymdDesde = `${d.anio}-${dos(d.mes)}-${dos(d.dia ?? 1)}`;
  const ymdHasta = `${h.anio}-${dos(h.mes)}-${dos(h.dia ?? diasDelMes(h.anio, h.mes))}`;
  return {
    desde: instanteCali(ymdDesde, "00:00:00"),
    hasta: instanteCali(ymdHasta, "23:59:59"),
  };
}

/** Rango [desde, hasta] en hora de Cali, o null si no es válido. */
export function rangoFechas(f: Fechas): { desde: Date; hasta: Date } | null {
  if (errorFechas(f) || !f.desde) return null;
  return rangoSinValidar(f.desde, f.hasta ?? f.desde);
}

/**
 * Nº de grupos de filtros activos (para el globito del botón): Cuándo,
 * Precio, Edad y Categorías cuentan 1 cada uno si no están en su valor por
 * defecto. "Fechas" solo cuenta si el rango es válido (si no, no filtra).
 */
export function contarFiltrosActivos(f: {
  filtro: Filtro;
  fechas: Fechas;
  precio: Precio;
  edad: FiltroEdad;
  tipos: string[];
}): number {
  const cuando =
    f.filtro === "fechas" ? rangoFechas(f.fechas) != null : f.filtro !== "proximos";
  return [cuando, f.precio !== "todo", f.edad !== "todo", f.tipos.length > 0].filter(Boolean)
    .length;
}

