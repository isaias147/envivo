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
  publisher_type: string | null;
  publisher_name: string | null;
  artist_name: string | null;
  artist_instagram: string | null;
  series_id: string | null;
  es_serie: boolean;
};

export type Filtro = "hoy" | "finde" | "proximos";

/** Barrio Granada, Cali. Fallback cuando el navegador niega la ubicación. */
export const GRANADA_CALI = { lat: 3.4566, lng: -76.5335 };

export const RADIOS_KM = [1, 3, 5] as const;
export type RadioKm = (typeof RADIOS_KM)[number];

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
): { desde: Date; hasta: Date | null } {
  const desde = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  const { ymd, dow } = fechaCali(ahora);

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

/** Quita un "@" inicial de un usuario de Instagram o TikTok. */
export function sinArroba(usuario: string): string {
  return usuario.replace(/^@+/, "").trim();
}

/**
 * Enlace de WhatsApp con el mensaje ya escrito. El número es el del
 * local u organizador (nunca el del artista). Se le dejan solo dígitos;
 * si viene con 10 (celular colombiano sin indicativo), se le antepone 57.
 */
export function enlaceWhatsapp(numero: string, titulo: string): string {
  const digitos = numero.replace(/\D/g, "");
  const conPais = digitos.length === 10 ? `57${digitos}` : digitos;
  const texto = `Hola, vi "${titulo}" en EnVivo y quiero preguntar por el evento.`;
  return `https://wa.me/${conPais}?text=${encodeURIComponent(texto)}`;
}

/**
 * Enlace `geo:` que abre la app de mapas del teléfono en el punto del
 * evento. En escritorio normalmente no hace nada; es una acción pensada
 * para el móvil.
 */
export function enlaceComoLlegar(
  lat: number,
  lng: number,
  etiqueta?: string | null,
): string {
  const punto = `${lat},${lng}`;
  const consulta = etiqueta ? `${punto}(${encodeURIComponent(etiqueta)})` : punto;
  return `geo:${punto}?q=${consulta}`;
}
