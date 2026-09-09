"use client";

// Formulario para publicar un evento. Sin registro: cualquiera con el
// link puede llegar aquí. Sigue los bloques "1 · Publicar evento" y
// "3 · Enviado" de envivo-pantallas-organizador.html.
//
// - Bifurca desde la primera pregunta: una sola vez / se repite.
// - La ubicación se marca con un pin arrastrable, nunca escribiendo dirección.
// - El flyer es obligatorio y se sube al bucket `flyers`.
// - Al enviar, inserta en `events` con status 'pendiente' (una fila por
//   fecha si es serie, agrupadas por `series_id`, con tope de 3 meses).
// - Antes de insertar, `hay_choque` revisa cada fecha; si choca, se abre
//   la hoja inferior con "Cambiar solo esa fecha" / "Escoger otro día".

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import {
  componerWhatsapp,
  GRANADA_CALI,
  PAIS_WHATSAPP_POR_DEFECTO,
  PAISES_WHATSAPP,
} from "@/lib/eventos";
import styles from "./page.module.css";

const MapaSelector = dynamic(() => import("@/components/MapaSelector"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

// ---------- utilidades de fecha en hora de Cali (UTC-5, sin DST) ----------

function hoyCali(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** ISO con zona de Cali a partir de "YYYY-MM-DD" y "HH:MM". */
function isoCali(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm}:00-05:00`;
}

/** Suma días a un "YYYY-MM-DD" sin liarse con zonas horarias. */
function sumarDiasYmd(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00-05:00`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo … 6 = sábado) de una fecha "YYYY-MM-DD". */
function dowCali(ymd: string): number {
  return new Date(`${ymd}T12:00:00-05:00`).getUTCDay();
}

// Chips de días en orden de semana: L M X J V S D.
const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0];
const CHIP_DIA = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRE_DIA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** "Jueves 17 de septiembre" a partir de "YYYY-MM-DD" (hora de Cali). */
function fechaLarga(ymd: string): string {
  const t = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${ymd}T12:00:00-05:00`));
  return (t.charAt(0).toUpperCase() + t.slice(1)).replace(",", "");
}

/** "8:00 PM" a partir de un ISO con zona. */
function horaBonita(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** "jueves" · "martes y jueves" · "lunes, miércoles y viernes". */
function listaDias(dias: number[]): string {
  const ns = DIAS_ORDEN.filter((d) => dias.includes(d)).map((d) => NOMBRE_DIA[d]);
  if (ns.length <= 1) return ns[0] ?? "";
  return `${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`;
}

/**
 * Fechas reales de una serie: por cada día de la semana marcado, en cada
 * semana activa (cada 7 o cada 14 días), desde la primera fecha hasta
 * `hastaYmd` — nunca más allá de 3 meses desde la primera fecha. Todas
 * comparten luego el mismo `series_id`.
 */
function fechasDeSerie(
  primeraYmd: string,
  hastaYmd: string,
  cadaDias: number,
  dias: number[],
): string[] {
  if (!primeraYmd || !hastaYmd || dias.length === 0) return [];

  const tope = new Date(`${primeraYmd}T12:00:00-05:00`);
  tope.setUTCMonth(tope.getUTCMonth() + 3);
  const topeYmd = tope.toISOString().slice(0, 10);
  const limite = hastaYmd < topeYmd ? hastaYmd : topeYmd;
  if (limite < primeraYmd) return [];

  // Lunes de la semana de la primera fecha, como ancla.
  const offsetLunes = (dowCali(primeraYmd) + 6) % 7;
  let lunes = sumarDiasYmd(primeraYmd, -offsetLunes);

  const fechas = new Set<string>();
  for (let semana = 0; lunes <= limite && semana < 80; semana++) {
    for (const dow of dias) {
      const f = sumarDiasYmd(lunes, (dow + 6) % 7);
      if (f >= primeraYmd && f <= limite) fechas.add(f);
    }
    lunes = sumarDiasYmd(lunes, cadaDias);
  }
  return [...fechas].sort();
}

// ---------- opciones del formulario ----------

const TIPOS: { valor: string; etiqueta: string }[] = [
  { valor: "musica_en_vivo", etiqueta: "Música en vivo" },
  { valor: "clase_taller", etiqueta: "Clase o taller" },
  { valor: "recreativo", etiqueta: "Recreativo" },
  { valor: "cultural", etiqueta: "Cultural" },
  { valor: "deportivo", etiqueta: "Deportivo" },
];

const MIMES_OK = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;
const RE_REEL = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i;

type Enviado = {
  hora: string;
  titulo: string;
  sede: string;
  precio: string;
  serieTexto: string | null;
};

// Choque detectado por hay_choque: alimenta la hoja inferior y sus dos salidas.
type Choque = {
  titulo: string; // nombre del evento que ya existe
  horaExistente: string; // "8:00 PM"
  diaNombre: string; // "jueves" — día de la fecha propia que choca
  fechaTexto: string; // "Jueves 17 de septiembre · 1 de 13 fechas"
  fechas: string[]; // todas las fechas (YYYY-MM-DD) que se iban a publicar
  colisiones: string[]; // subconjunto de `fechas` que choca con algo
};

// Un resultado del buscador de ciudad (proxy /api/geocode → Nominatim).
type ResultadoGeo = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export default function PublicarNuevo() {
  // bifurcación
  const [serie, setSerie] = useState(false);
  const [cadaDias, setCadaDias] = useState<7 | 14>(7);
  // Días de la semana marcados a mano (0 = domingo … 6 = sábado). El día de
  // la primera fecha se añade aparte, en `diasEfectivos`.
  const [diasSemana, setDiasSemana] = useState<number[]>([]);

  // datos del evento
  const [nombre, setNombre] = useState("");
  const [lugar, setLugar] = useState("");
  const [punto, setPunto] = useState(GRANADA_CALI);
  const [puntoMovido, setPuntoMovido] = useState(false);
  // Buscador de ciudad (Nominatim) sobre el mini-mapa.
  const [consultaCiudad, setConsultaCiudad] = useState("");
  const [resultadosCiudad, setResultadosCiudad] = useState<ResultadoGeo[]>([]);
  const [buscandoCiudad, setBuscandoCiudad] = useState(false);
  // Punto al que saltar cuando se elige un resultado; `id` fuerza el salto.
  const [objetivoMapa, setObjetivoMapa] = useState<{
    lat: number;
    lng: number;
    id: number;
  } | null>(null);
  // Evita relanzar la búsqueda cuando el propio "elegir" rellena el campo.
  const ignorarBusquedaCiudad = useRef(false);
  const [fecha, setFecha] = useState(hoyCali());
  const [hora, setHora] = useState("20:00");
  const [hasta, setHasta] = useState(sumarDiasYmd(hoyCali(), 56));
  const [tipo, setTipo] = useState(TIPOS[0].valor);
  const [entrada, setEntrada] = useState<"gratis" | "cover" | "rango">("cover");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [reel, setReel] = useState("");

  // quién publica y contacto
  const [quien, setQuien] = useState<"local" | "organizador" | "artista">("local");
  const [quienNombre, setQuienNombre] = useState("");
  const [paisWa, setPaisWa] = useState<string>(PAIS_WHATSAPP_POR_DEFECTO); // Colombia
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");

  // Perfil del publicador autenticado (cookie `envivo_publicador`, Sesión 12).
  // Si existe, el evento hereda `perfil_id` + nombre + redes del perfil y esos
  // campos no se piden en el formulario. Si no, sigue el flujo viejo (sin
  // perfil): cualquiera con el link publica y escribe su nombre a mano.
  const [perfilSesion, setPerfilSesion] = useState<{
    perfilId: string;
    nombre: string | null;
  } | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const conPerfil = perfilSesion !== null;

  // flyer
  const [flyer, setFlyer] = useState<File | null>(null);
  const [flyerPrev, setFlyerPrev] = useState<string | null>(null);

  // trampa para bots: debe quedar vacío
  const [trampa, setTrampa] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  // Nº de fechas pendiente de confirmar (series de más de 40).
  const [confirmarN, setConfirmarN] = useState<number | null>(null);
  // Choque pendiente de resolver: mientras no sea null, se ve la hoja inferior.
  const [choque, setChoque] = useState<Choque | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ¿Hay publicador autenticado? Una sola consulta al montar.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/publicador/sesion", { cache: "no-store" });
        const j = await r.json();
        if (vivo && j.activa && j.perfilId) {
          setPerfilSesion({ perfilId: j.perfilId, nombre: j.nombre ?? null });
        }
      } catch {
        // sin sesión o sin red: flujo viejo, con los campos a mano
      }
      if (vivo) setSesionLista(true);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto((p) =>
          // solo si el usuario aún no recolocó el pin
          p === GRANADA_CALI
            ? { lat: pos.coords.latitude, lng: pos.coords.longitude }
            : p,
        );
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    return () => {
      if (flyerPrev) URL.revokeObjectURL(flyerPrev);
    };
  }, [flyerPrev]);

  // Buscador de ciudad: espera a que el organizador termine de escribir
  // (debounce de 800 ms, según la política de uso de Nominatim) y consulta
  // el proxy del servidor. Cada tecla cancela la petición anterior.
  useEffect(() => {
    if (ignorarBusquedaCiudad.current) {
      ignorarBusquedaCiudad.current = false;
      return;
    }
    const q = consultaCiudad.trim();
    if (q.length < 3) return; // el onChange ya limpió los resultados

    const control = new AbortController();
    const t = setTimeout(async () => {
      setBuscandoCiudad(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: control.signal,
        });
        const j = r.ok ? await r.json() : { resultados: [] };
        setResultadosCiudad(Array.isArray(j.resultados) ? j.resultados : []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResultadosCiudad([]);
      } finally {
        setBuscandoCiudad(false);
      }
    }, 800);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [consultaCiudad]);

  const dowPrimera = fecha ? dowCali(fecha) : -1;

  // El día de la primera fecha va siempre en la serie: se fusiona con los
  // que el usuario marcó a mano, sin necesidad de un efecto.
  const diasEfectivos = useMemo(() => {
    if (dowPrimera < 0 || diasSemana.includes(dowPrimera)) return diasSemana;
    return [...diasSemana, dowPrimera];
  }, [diasSemana, dowPrimera]);

  // Fechas reales de la serie: una por día marcado en cada semana activa.
  const fechasSerie = useMemo(
    () => (serie ? fechasDeSerie(fecha, hasta, cadaDias, diasEfectivos) : []),
    [serie, fecha, hasta, cadaDias, diasEfectivos],
  );

  // Resumen de la serie, como en el mockup.
  const resumenSerie = useMemo(() => {
    if (!serie) return "";
    if (!fecha || !hasta || hasta < fecha)
      return "Elige una fecha final posterior a la primera.";
    if (diasEfectivos.length === 0)
      return "Marca al menos un día de la semana.";
    const n = fechasSerie.length;
    const lista = listaDias(diasEfectivos);
    const cuerpo = diasEfectivos.length === 1 ? `todos los ${lista}` : lista;
    return `Saldrá ${cuerpo}: ${n} ${n === 1 ? "fecha" : "fechas"}`;
  }, [serie, fecha, hasta, diasEfectivos, fechasSerie]);

  function elegirPin(lat: number, lng: number) {
    setPunto({ lat, lng });
    setPuntoMovido(true);
  }

  // Al elegir un resultado del buscador: el mapa salta ahí y el pin se pone
  // en el centro. El organizador sigue pudiendo arrastrarlo para ajustar.
  function elegirCiudad(r: ResultadoGeo) {
    const lat = Number.parseFloat(r.lat);
    const lng = Number.parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    setPunto({ lat, lng });
    setPuntoMovido(true);
    setObjetivoMapa({ lat, lng, id: Date.now() });
    setResultadosCiudad([]);
    setBuscandoCiudad(false);
    ignorarBusquedaCiudad.current = true;
    setConsultaCiudad(r.display_name.split(",").slice(0, 3).join(",").trim());
  }

  // Cambios que alteran la forma de la serie: anulan la confirmación pendiente.
  function cambiarSerie(v: boolean) {
    setSerie(v);
    setConfirmarN(null);
    setChoque(null);
  }
  function cambiarFecha(v: string) {
    setFecha(v);
    setConfirmarN(null);
    setChoque(null);
  }
  function cambiarHasta(v: string) {
    setHasta(v);
    setConfirmarN(null);
    setChoque(null);
  }
  function cambiarCadaDias(v: 7 | 14) {
    setCadaDias(v);
    setConfirmarN(null);
    setChoque(null);
  }

  function toggleDia(d: number) {
    if (d === dowPrimera) return; // el día de la primera fecha no se quita
    setConfirmarN(null);
    setChoque(null);
    setDiasSemana((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  function elegirFlyer(f: File | null) {
    setError(null);
    if (!f) return;
    if (!MIMES_OK.includes(f.type)) {
      setError("El flyer debe ser JPG, PNG o WebP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("El flyer pesa más de 3 MB. Súbelo más liviano.");
      return;
    }
    if (flyerPrev) URL.revokeObjectURL(flyerPrev);
    setFlyer(f);
    setFlyerPrev(URL.createObjectURL(f));
  }

  function quitarFlyer() {
    if (flyerPrev) URL.revokeObjectURL(flyerPrev);
    setFlyer(null);
    setFlyerPrev(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pesoLegible(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;
  }

  // Normaliza el link del reel; devuelve null si el campo está vacío,
  // o `false` si no es de Instagram/TikTok.
  function normalizarReel(valor: string): string | null | false {
    const v = valor.trim();
    if (!v) return null;
    let url = v;
    if (url.startsWith("http://")) url = "https://" + url.slice(7);
    else if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return RE_REEL.test(url) ? url : false;
  }

  const labelWhatsapp =
    quien === "artista" ? "WhatsApp del local" : "WhatsApp para reservas";
  const ayudaWhatsapp =
    quien === "artista"
      ? "El contacto siempre es del local, nunca del artista."
      : "Es el botón principal del evento. Aquí te escribe la gente.";

  async function enviar() {
    if (enviando) return;
    setError(null);

    // Trampa: si un bot llenó el campo oculto, fingimos éxito y no insertamos.
    if (trampa.trim()) {
      setEnviado({
        hora: "",
        titulo: nombre.trim() || "Tu evento",
        sede: lugar.trim(),
        precio: "",
        serieTexto: null,
      });
      return;
    }

    const titulo = nombre.trim();
    if (titulo.length < 3) {
      setError("Ponle un nombre de al menos 3 letras al evento.");
      return;
    }
    if (titulo.length > 120) {
      setError("El nombre es muy largo (máximo 120 caracteres).");
      return;
    }
    if (!puntoMovido) {
      setError("Arrastra el pin al lugar exacto del evento.");
      return;
    }
    if (!lugar.trim()) {
      setError("Escribe cómo se llama el lugar.");
      return;
    }
    if (!fecha || !hora) {
      setError("Falta la fecha o la hora.");
      return;
    }
    if (new Date(isoCali(fecha, hora)).getTime() <= Date.now()) {
      setError("La fecha y la hora deben ser futuras.");
      return;
    }
    if (serie && (!hasta || hasta < fecha)) {
      setError("Elige hasta cuándo se repite (una fecha posterior a la primera).");
      return;
    }
    if (serie && diasEfectivos.length === 0) {
      setError("Marca al menos un día de la semana para la serie.");
      return;
    }
    if (entrada !== "gratis" && !monto.trim()) {
      setError("Escribe el valor de la entrada.");
      return;
    }
    if (descripcion.length > 200) {
      setError("La descripción no puede pasar de 200 caracteres.");
      return;
    }
    if (!conPerfil && !quienNombre.trim()) {
      setError("Escribe el nombre de quien publica.");
      return;
    }
    if (!whatsapp.trim()) {
      setError("Falta el WhatsApp de contacto.");
      return;
    }
    if (!flyer) {
      setError("El flyer es obligatorio.");
      return;
    }
    const reelUrl = normalizarReel(reel);
    if (reelUrl === false) {
      setError("El link debe ser de Instagram o TikTok (o déjalo vacío).");
      return;
    }

    if (serie) {
      if (fechasSerie.length === 0) {
        setError("Con esos días y esa fecha final la serie no genera fechas.");
        return;
      }
      // Serie larga: pedir confirmación explícita antes de crear tantas filas.
      if (fechasSerie.length > 40 && confirmarN !== fechasSerie.length) {
        setConfirmarN(fechasSerie.length);
        return;
      }
    }

    // Fechas reales a publicar: una sola, o todas las de la serie en orden.
    const fechas = serie ? fechasSerie : [fecha];

    // Antes de insertar nada, preguntarle a Supabase si alguna de esas fechas
    // choca con otro evento del mismo WhatsApp, mismo lugar y misma hora.
    setEnviando(true);
    let choqueEncontrado: Choque | null;
    try {
      choqueEncontrado = await buscarChoque(fechas);
    } catch {
      setError(
        "No pudimos revisar si la fecha se cruza con otro evento tuyo. Intenta de nuevo.",
      );
      setEnviando(false);
      return;
    }
    if (choqueEncontrado) {
      // No insertamos: mostramos la hoja inferior y esperamos a que el usuario
      // decida entre "Cambiar solo esa fecha" y "Escoger otro día".
      setConfirmarN(null);
      setChoque(choqueEncontrado);
      setEnviando(false);
      return;
    }

    await publicar(fechas);
  }

  /**
   * Consulta `hay_choque` para cada fecha, en orden. Devuelve los datos de la
   * hoja inferior si alguna choca (reportando la primera colisión), o null si
   * están todas libres.
   */
  async function buscarChoque(fechas: string[]): Promise<Choque | null> {
    // Mismo formato con el que se guarda en `events.whatsapp` (indicativo +
    // dígitos), para que `hay_choque`, que compara por igualdad exacta,
    // encuentre los cruces.
    const wa = componerWhatsapp(paisWa, whatsapp);
    const colisiones: string[] = [];
    let existente: { title: string; starts_at: string } | null = null;

    for (const ymd of fechas) {
      const { data, error: errRpc } = await supabase.rpc("hay_choque", {
        p_whatsapp: wa,
        p_lat: punto.lat,
        p_lng: punto.lng,
        p_starts: isoCali(ymd, hora),
      });
      if (errRpc) throw errRpc;
      if (data && data.length > 0) {
        colisiones.push(ymd);
        if (!existente) {
          existente = { title: data[0].title, starts_at: data[0].starts_at };
        }
      }
    }

    if (!existente) return null;

    const primera = colisiones[0];
    const indice = fechas.indexOf(primera) + 1;
    return {
      titulo: existente.title,
      horaExistente: horaBonita(existente.starts_at),
      diaNombre: NOMBRE_DIA[dowCali(primera)],
      fechaTexto: serie
        ? `${fechaLarga(primera)} · ${indice} de ${fechas.length} fechas`
        : fechaLarga(primera),
      fechas,
      colisiones,
    };
  }

  /**
   * Sube el flyer e inserta una fila por cada fecha recibida (todas con el
   * mismo `series_id` si es serie). Se llama sin choques, o con la serie ya
   * recortada desde la hoja inferior. Al terminar muestra la pantalla de
   * "enviado".
   */
  async function publicar(fechas: string[]) {
    if (!flyer) {
      setError("El flyer es obligatorio.");
      setEnviando(false);
      return;
    }
    if (fechas.length === 0) {
      setError("No quedan fechas para publicar. Ajusta la serie.");
      setEnviando(false);
      return;
    }
    const titulo = nombre.trim();
    const reelUrl = normalizarReel(reel) || null;

    setEnviando(true);
    try {
      // 1. Subir el flyer al bucket `flyers`.
      const ext = (flyer.name.split(".").pop() || "jpg").toLowerCase();
      const ruta = `publico/${crypto.randomUUID()}.${ext}`;
      const { error: errSubida } = await supabase.storage
        .from("flyers")
        .upload(ruta, flyer, { contentType: flyer.type, upsert: false });
      if (errSubida) {
        setError("No se pudo subir el flyer. Intenta de nuevo.");
        setEnviando(false);
        return;
      }
      const { data: pub } = supabase.storage.from("flyers").getPublicUrl(ruta);
      const flyerUrl = pub.publicUrl;

      // 2. Armar la(s) fila(s).
      const esGratis = entrada === "gratis";
      const montoNum = Number(monto.replace(/[^\d]/g, "")) || null;
      const etiquetaPrecio = esGratis
        ? null
        : entrada === "cover"
          ? `Cover ${monto.trim()}`
          : monto.trim();

      const seriesId = serie ? crypto.randomUUID() : null;

      const base = {
        title: titulo,
        description: descripcion.trim() || null,
        type: tipo,
        cover_url: flyerUrl,
        venue_name: lugar.trim(),
        latitude: punto.lat,
        longitude: punto.lng,
        is_free: esGratis,
        price: esGratis ? null : montoNum,
        price_label: etiquetaPrecio,
        status: "pendiente" as const,
        is_recurring: serie,
        recurrence_rule: serie
          ? cadaDias === 7
            ? "FREQ=WEEKLY"
            : "FREQ=WEEKLY;INTERVAL=2"
          : null,
        series_id: seriesId,
        publisher_type: quien,
        // Con perfil: el nombre y las redes salen del perfil (por eso no se
        // piden en el form). `perfil_id` enlaza el evento → /p/[slug]. Sin
        // perfil: como siempre, lo que escribió la persona.
        publisher_name: conPerfil
          ? perfilSesion.nombre ?? null
          : quienNombre.trim(),
        whatsapp: componerWhatsapp(paisWa, whatsapp),
        instagram: conPerfil ? null : instagram.trim() || null,
        tiktok: conPerfil ? null : tiktok.trim() || null,
        perfil_id: conPerfil ? perfilSesion.perfilId : null,
        post_url: reelUrl,
        city: "Cali",
      };

      const filas = fechas.map((ymd) => ({
        ...base,
        starts_at: isoCali(ymd, hora),
      }));

      const { error: errInsert } = await supabase.from("events").insert(filas);
      if (errInsert) {
        setError("No se pudo enviar el evento. Intenta de nuevo.");
        setEnviando(false);
        return;
      }

      // 3. Pantalla de "enviado".
      const [hh, mm] = hora.split(":").map(Number);
      const periodo = hh >= 12 ? "PM" : "AM";
      const h12 = ((hh + 11) % 12) + 1;
      setEnviado({
        hora: `${h12}:${String(mm).padStart(2, "0")} ${periodo}`,
        titulo,
        sede: lugar.trim(),
        precio: esGratis ? "Gratis" : etiquetaPrecio || "Entrada paga",
        serieTexto: serie
          ? `${listaDias(diasEfectivos)} · ${filas.length} fechas`
          : null,
      });
      window.scrollTo({ top: 0 });
    } catch {
      setError("Algo falló al enviar. Revisa tu conexión e intenta de nuevo.");
      setEnviando(false);
    }
  }

  // Esperamos a saber si hay publicador autenticado antes de pintar el
  // formulario, así no se ven y se esconden los campos de nombre/redes.
  if (!sesionLista) {
    return (
      <div className={styles.pantalla}>
        <div className={styles.marco}>
          <div className={styles.marca}>
            En<i>Vivo</i>
          </div>
          <div className={styles.ruta}>envivo.app/publicar</div>
          <p className={styles.bajada}>Cargando…</p>
        </div>
      </div>
    );
  }

  // ---------------- pantalla de "enviado" ----------------
  if (enviado) {
    return (
      <div className={styles.pantalla}>
        <div className={styles.marco}>
          <div className={styles.marca}>
            En<i>Vivo</i>
          </div>
          <div className={styles.ruta}>envivo.app/publicar</div>

          <div className={styles.marcaOk} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 12.5l5.5 5.5L20 7" />
            </svg>
          </div>
          <h1 className={styles.tit}>Tu evento va en camino</h1>
          <p className={styles.bajada}>
            Lo revisamos hoy mismo y aparece en el mapa. Te avisamos por
            WhatsApp cuando esté arriba.
          </p>

          <div className={styles.tarjetaRes}>
            {enviado.hora && <div className={styles.resHora}>{enviado.hora}</div>}
            <b>{enviado.titulo}</b>
            {(enviado.sede || enviado.precio) && (
              <small>
                {[enviado.sede, enviado.precio].filter(Boolean).join(" · ")}
              </small>
            )}
            {enviado.serieTexto && (
              <div className={styles.pillSerie}>{enviado.serieTexto}</div>
            )}
          </div>

          <button
            type="button"
            className={styles.fantasma}
            onClick={() => window.location.reload()}
          >
            Publicar otro evento
          </button>
          <Link href="/publicar" className={styles.volverMapa}>
            Volver al mapa
          </Link>
        </div>
      </div>
    );
  }

  // ---------------- formulario ----------------
  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/publicar</div>
        <h1 className={styles.tit}>Publica tu evento</h1>
        <p className={styles.bajada}>
          Es gratis. Lo revisamos y queda en el mapa el mismo día.
        </p>

        {conPerfil && perfilSesion.nombre && (
          <div className={styles.publicandoComo}>
            Publicando como <b>{perfilSesion.nombre}</b>
          </div>
        )}

        {/* 1 · bifurcación */}
        <div className={styles.campo}>
          <label>¿Es una sola vez o se repite?</label>
          <div className={styles.trio}>
            <button
              type="button"
              className={styles.op}
              aria-pressed={!serie}
              onClick={() => cambiarSerie(false)}
            >
              Una sola vez
            </button>
            <button
              type="button"
              className={styles.op}
              aria-pressed={serie}
              onClick={() => cambiarSerie(true)}
            >
              Se repite
            </button>
          </div>
        </div>

        {/* nombre */}
        <div className={styles.campo}>
          <label htmlFor="nombre">Nombre del evento</label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setError(null);
            }}
            placeholder="Noche de salsa con La Clave"
          />
        </div>

        {/* dónde: buscador de ciudad + pin arrastrable */}
        <div className={styles.campo}>
          <label htmlFor="buscar-ciudad">¿Dónde es?</label>

          <div className={styles.buscadorCiudad}>
            <input
              id="buscar-ciudad"
              type="text"
              autoComplete="off"
              value={consultaCiudad}
              onChange={(e) => {
                const v = e.target.value;
                setConsultaCiudad(v);
                if (v.trim().length < 3) {
                  setResultadosCiudad([]);
                  setBuscandoCiudad(false);
                }
              }}
              onBlur={() =>
                window.setTimeout(() => setResultadosCiudad([]), 120)
              }
              placeholder="Busca una ciudad o lugar"
            />
            {buscandoCiudad && (
              <span className={styles.buscandoCiudad}>Buscando…</span>
            )}
            {resultadosCiudad.length > 0 && (
              <ul className={styles.resultadosCiudad}>
                {resultadosCiudad.map((r) => (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegirCiudad(r)}
                    >
                      {r.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!buscandoCiudad &&
              resultadosCiudad.length === 0 &&
              consultaCiudad.trim().length >= 3 && (
                <span className={styles.buscandoCiudad}>
                  Sin resultados. Prueba con otro nombre o mueve el pin a mano.
                </span>
              )}
          </div>

          <div className={styles.mapita}>
            <MapaSelector
              punto={punto}
              movido={puntoMovido}
              onCambio={elegirPin}
              objetivo={objetivoMapa}
            />
            <div className={styles.pista}>
              {puntoMovido
                ? "Arrastra el pin para ajustarlo"
                : "Arrastra el pin al punto exacto"}
            </div>
          </div>
          <input
            style={{ marginTop: 9 }}
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Bar La Topa Tolondra"
          />
          <p className={styles.ayuda}>
            Escribe cómo lo conoce la gente. Si es un parque o una plaza,
            descríbelo.
          </p>
        </div>

        {/* fecha / hora */}
        <div className={`${styles.campo} ${styles.duo}`}>
          <div>
            <label htmlFor="fecha">{serie ? "Primera fecha" : "Fecha"}</label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              min={hoyCali()}
              onChange={(e) => cambiarFecha(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="hora">Hora</label>
            <input
              id="hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        {/* caja de serie */}
        {serie && (
          <div className={styles.cajaSerie}>
            <div className={styles.campo} style={{ marginBottom: 14 }}>
              <label className={styles.labelLaton}>¿Qué días?</label>
              <div className={styles.chipsDias}>
                {DIAS_ORDEN.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={styles.chipDia}
                    aria-pressed={diasEfectivos.includes(d)}
                    aria-label={NOMBRE_DIA[d]}
                    title={
                      d === dowPrimera
                        ? `${NOMBRE_DIA[d]}: día de la primera fecha`
                        : NOMBRE_DIA[d]
                    }
                    onClick={() => toggleDia(d)}
                  >
                    {CHIP_DIA[i]}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.campo} style={{ marginBottom: 14 }}>
              <label className={styles.labelLaton}>¿Cada cuánto?</label>
              <div className={styles.trio}>
                <button
                  type="button"
                  className={styles.op}
                  aria-pressed={cadaDias === 7}
                  onClick={() => cambiarCadaDias(7)}
                >
                  Cada semana
                </button>
                <button
                  type="button"
                  className={styles.op}
                  aria-pressed={cadaDias === 14}
                  onClick={() => cambiarCadaDias(14)}
                >
                  Cada 15 días
                </button>
              </div>
            </div>
            <label className={styles.labelLaton} htmlFor="hasta">
              ¿Hasta cuándo?
            </label>
            <input
              id="hasta"
              type="date"
              value={hasta}
              min={fecha}
              onChange={(e) => cambiarHasta(e.target.value)}
            />
            {resumenSerie && (
              <p className={styles.resumenSerie}>{resumenSerie}</p>
            )}
          </div>
        )}

        {/* tipo */}
        <div className={styles.campo}>
          <label htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>

        {/* entrada */}
        <div className={styles.campo}>
          <label>Entrada</label>
          <div className={styles.trio}>
            <button
              type="button"
              className={`${styles.op} ${styles.verde}`}
              aria-pressed={entrada === "gratis"}
              onClick={() => setEntrada("gratis")}
            >
              Gratis
            </button>
            <button
              type="button"
              className={styles.op}
              aria-pressed={entrada === "cover"}
              onClick={() => setEntrada("cover")}
            >
              Cover
            </button>
            <button
              type="button"
              className={styles.op}
              aria-pressed={entrada === "rango"}
              onClick={() => setEntrada("rango")}
            >
              Rango
            </button>
          </div>
          {entrada !== "gratis" && (
            <input
              style={{ marginTop: 9 }}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder={entrada === "rango" ? "$20.000 a $40.000" : "$20.000"}
              inputMode="numeric"
            />
          )}
        </div>

        {/* flyer */}
        <div className={styles.campo}>
          <label>Flyer del evento</label>
          {flyer && flyerPrev ? (
            <div className={styles.subido}>
              <div className={styles.prev}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flyerPrev} alt="Vista previa del flyer" />
              </div>
              <div>
                <p>{flyer.name}</p>
                <small>{pesoLegible(flyer.size)}</small>
              </div>
              <button
                type="button"
                className={styles.quitar}
                onClick={quitarFlyer}
              >
                Quitar
              </button>
            </div>
          ) : (
            <label className={styles.soltar}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => elegirFlyer(e.target.files?.[0] ?? null)}
              />
              <b>Sube el flyer</b>
              <span>JPG, PNG o WebP · máximo 3 MB</span>
            </label>
          )}
          {serie && (
            <div className={styles.avisoFlyer}>
              Súbelo sin fecha impresa: nosotros mostramos cada fecha de la
              serie.
            </div>
          )}
        </div>

        {/* descripción con contador */}
        <div className={styles.campo}>
          <label htmlFor="desc">
            De qué se trata{" "}
            <span className={styles.contador}>{descripcion.length}/200</span>
          </label>
          <textarea
            id="desc"
            rows={3}
            maxLength={200}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Orquesta en vivo y pista abierta desde las 9. Ideal si vienes solo o en grupo."
          />
        </div>

        {/* reel opcional */}
        <div className={styles.campo}>
          <label htmlFor="reel">Link de tu reel o TikTok</label>
          <input
            id="reel"
            value={reel}
            onChange={(e) => setReel(e.target.value)}
            placeholder="instagram.com/reel/…"
          />
          <p className={styles.ayuda}>
            Opcional. Un video del ambiente convence más que el flyer.
          </p>
        </div>

        {/* quién publica */}
        <div className={styles.campo}>
          <label>¿Quién publica?</label>
          <div className={styles.trio}>
            <button
              type="button"
              className={styles.op}
              aria-pressed={quien === "local"}
              onClick={() => setQuien("local")}
            >
              El local
            </button>
            <button
              type="button"
              className={styles.op}
              aria-pressed={quien === "organizador"}
              onClick={() => setQuien("organizador")}
            >
              Organizador
            </button>
            <button
              type="button"
              className={styles.op}
              aria-pressed={quien === "artista"}
              onClick={() => setQuien("artista")}
            >
              Artista
            </button>
          </div>
        </div>

        {!conPerfil && (
          <div className={styles.campo}>
            <label htmlFor="quien-nombre">Nombre de quien publica</label>
            <input
              id="quien-nombre"
              value={quienNombre}
              onChange={(e) => setQuienNombre(e.target.value)}
              placeholder="Bar La Topa Tolondra"
            />
          </div>
        )}

        <div className={styles.campo}>
          <label htmlFor="whatsapp">{labelWhatsapp}</label>
          <div className={styles.filaPais}>
            <select
              id="wa-pais"
              aria-label="País del WhatsApp"
              value={paisWa}
              onChange={(e) => setPaisWa(e.target.value)}
            >
              {PAISES_WHATSAPP.map((p) => (
                <option key={p.nombre} value={p.indicativo}>
                  {p.nombre} +{p.indicativo}
                </option>
              ))}
            </select>
            <input
              id="whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="300 123 4567"
            />
          </div>
          <p className={styles.ayuda}>{ayudaWhatsapp}</p>
        </div>

        {!conPerfil && (
          <div className={`${styles.campo} ${styles.duo}`}>
            <div>
              <label htmlFor="ig">Instagram</label>
              <input
                id="ig"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@latopa"
              />
            </div>
            <div>
              <label htmlFor="tk">TikTok</label>
              <input
                id="tk"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@latopa"
              />
            </div>
          </div>
        )}

        {/* honeypot: invisible para personas, tentador para bots */}
        <div className={styles.trampa} aria-hidden="true">
          <label htmlFor="sitio-web">No llenes este campo</label>
          <input
            id="sitio-web"
            name="sitio-web"
            tabIndex={-1}
            autoComplete="off"
            value={trampa}
            onChange={(e) => setTrampa(e.target.value)}
          />
        </div>

        {confirmarN !== null ? (
          <div className={styles.avisoConfirm}>
            <p>
              Vas a crear <b>{confirmarN} fechas</b> de una vez. Revisa los días
              y la fecha final; si está bien, confírmalo.
            </p>
            <button
              type="button"
              className={styles.enviar}
              style={{ marginTop: 0 }}
              onClick={enviar}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : `Sí, crear ${confirmarN} fechas`}
            </button>
            <button
              type="button"
              className={styles.fantasma}
              onClick={() => setConfirmarN(null)}
            >
              Ajustar la serie
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.enviar}
            onClick={enviar}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : "Enviar evento"}
          </button>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {choque && (
        <div
          className={styles.velo}
          role="dialog"
          aria-modal="true"
          aria-label="Ya tienes un evento a esa hora"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChoque(null);
          }}
        >
          <div className={styles.hoja}>
            <h3>Ya tienes algo ese {choque.diaNombre}</h3>
            <p>
              Se cruza con «{choque.titulo}», a la misma hora y en el mismo
              lugar.
              {serie && choque.colisiones.length < choque.fechas.length
                ? " Puedes dejar esa fecha por fuera y publicar el resto de la serie."
                : " Cambia la fecha o la hora para no repetirte."}
            </p>
            <div className={styles.choca}>
              <div className={styles.chocaHora}>{choque.horaExistente}</div>
              <div>
                <b>{choque.titulo}</b>
                <small>{choque.fechaTexto}</small>
              </div>
            </div>
            {serie && choque.colisiones.length < choque.fechas.length && (
              <button
                type="button"
                className={styles.enviar}
                style={{ marginTop: 0 }}
                disabled={enviando}
                onClick={() => {
                  const quedan = choque.fechas.filter(
                    (f) => !choque.colisiones.includes(f),
                  );
                  setChoque(null);
                  publicar(quedan);
                }}
              >
                {choque.colisiones.length === 1
                  ? "Cambiar solo esa fecha"
                  : `Quitar esas ${choque.colisiones.length} fechas y publicar`}
              </button>
            )}
            <button
              type="button"
              className={styles.fantasma}
              onClick={() => setChoque(null)}
            >
              Escoger otro día
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
