#!/usr/bin/env node
/*
 * EnVivo · datos de prueba
 * -------------------------------------------------------------------------
 * Inserta 48 eventos con estado 'aprobado' y sube un flyer de prueba por
 * evento al bucket `flyers`, para que las tarjetas del mapa y la lista no
 * salgan sin imagen. Reparto por ciudad (coordenadas reales de zonas de
 * vida nocturna y cultural):
 *
 *    8  Cali, Colombia        (Granada y San Fernando · las originales)
 *   10  Valencia, Venezuela
 *   10  Caracas, Venezuela
 *   10  San José, Costa Rica
 *   10  Cali, Colombia        (El Peñón, San Antonio, Menga, Obrero…)
 *
 * Las fechas se calculan relativas al momento de ejecución (mañana … +20
 * días) para que siempre queden futuras. Cada ciudad trae al menos dos
 * series recurrentes. El UUID de cada evento es fijo (posición en `base`),
 * así que se puede re-ejecutar sin duplicar.
 *
 *   node scripts/seed-eventos.mjs            inserta / actualiza los 48 eventos
 *   node scripts/seed-eventos.mjs --limpiar  borra esos 48 eventos y sus flyers
 *   node scripts/seed-eventos.mjs --png      solo genera los PNG en disco
 *                                            (scripts/flyers-prueba/), sin tocar Supabase
 *
 * Necesita en .env.local, además de las variables que ya usa el front:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Se saca del panel de Supabase: Project Settings > API > service_role.
 * Es una llave de servidor: NO le pongas el prefijo NEXT_PUBLIC_ y no la subas
 * al repo. .env.local ya está en .gitignore.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const RAIZ = new URL("../", import.meta.url);
const BUCKET = "flyers";
const CARPETA = "seed"; // prefijo dentro del bucket
const modo = process.argv[2] ?? "";

// ---------------------------------------------------------------------------
// 1. Variables de entorno (.env.local + process.env)
// ---------------------------------------------------------------------------
function cargarEnv(url) {
  let texto;
  try {
    texto = readFileSync(url, "utf8");
  } catch {
    return {};
  }
  const env = {};
  for (const linea of texto.split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i === -1) continue;
    env[l.slice(0, i).trim()] = l
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...cargarEnv(new URL(".env.local", RAIZ)), ...process.env };
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// 2. Generador de PNG (poster de prueba, sin dependencias)
//    Fondo liso + disco de acento arriba a la derecha + franja inferior.
// ---------------------------------------------------------------------------
const CRC_TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([len, cuerpo, crc]);
}

function hexRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function flyerPng(fondoHex, acentoHex, ancho = 600, alto = 800) {
  const [fr, fg, fb] = hexRgb(fondoHex);
  const [ar, ag, ab] = hexRgb(acentoHex);
  const cx = ancho * 0.72;
  const cy = alto * 0.24;
  const rad = ancho * 0.34;
  const franja = alto * 0.8;

  const filas = Buffer.alloc(alto * (1 + ancho * 3));
  let p = 0;
  for (let y = 0; y < alto; y++) {
    filas[p++] = 0; // filtro "none" por fila
    for (let x = 0; x < ancho; x++) {
      let r = fr;
      let g = fg;
      let b = fb;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) {
        r = ar;
        g = ag;
        b = ab;
      } else if (y >= franja) {
        r = (fr + ar) >> 1;
        g = (fg + ag) >> 1;
        b = (fb + ab) >> 1;
      }
      filas[p++] = r;
      filas[p++] = g;
      filas[p++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad de bit
  ihdr[9] = 2; // tipo de color 2 = RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(filas, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 3. Fechas relativas en hora de Cali (UTC-5, sin horario de verano)
// ---------------------------------------------------------------------------
function ymdCaliHoy() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function enDiasCali(dias, hhmm) {
  const base = new Date(`${ymdCaliHoy()}T12:00:00-05:00`);
  base.setUTCDate(base.getUTCDate() + dias);
  return new Date(`${base.toISOString().slice(0, 10)}T${hhmm}:00-05:00`);
}

function masHoras(fecha, horas) {
  return new Date(fecha.getTime() + horas * 3600 * 1000);
}

function diasHastaProximoViernes() {
  const dow = new Date(`${ymdCaliHoy()}T12:00:00-05:00`).getUTCDay(); // 0 = domingo
  return (5 - dow + 7) % 7 || 7;
}

// ---------------------------------------------------------------------------
// 4. Los eventos base — Cali · Granada y San Fernando
// ---------------------------------------------------------------------------
const SERIE_SALSA = "5e21e000-0000-4000-8000-00000000a001";

// Granada: alrededor de la Avenida 9 Norte entre calles 15 y 17.
// San Fernando: alrededor del Parque del Perro y la Calle 5.
const base = [
  {
    slug: "evento-1",
    fondo: "#B8232F",
    acento: "#FFB627",
    title: "Noche de salsa con La Clave",
    description:
      "Orquesta completa en tarima y pista abierta toda la noche. Llega antes de las 10 si quieres mesa.",
    type: "musica_en_vivo",
    venue_name: "Zaperoco Bar",
    venue_address: "Av. 5 Norte # 16-46, Granada",
    latitude: 3.4569,
    longitude: -76.5327,
    starts_at: enDiasCali(1, "21:00"),
    duracion: 4,
    is_free: false,
    price: 25000,
    price_label: "Cover $25.000",
    publisher_type: "local",
    publisher_name: "Zaperoco Bar",
    whatsapp: "+57 315 555 0101",
    instagram: "zaperocobar",
    tiktok: "zaperocobar",
  },
  {
    slug: "evento-2",
    fondo: "#1F6F8B",
    acento: "#FFD166",
    title: "Clase de salsa para principiantes",
    description:
      "Una hora de pasos básicos. No necesitas pareja ni experiencia previa, solo zapatos cómodos.",
    type: "clase_taller",
    venue_name: "Escuela Swing Latino",
    venue_address: "Carrera 38 # 4-21, San Fernando",
    latitude: 3.4238,
    longitude: -76.5432,
    starts_at: enDiasCali(2, "18:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Escuela Swing Latino",
    whatsapp: "+57 316 555 0202",
    instagram: "swinglatino.cali",
    series_id: SERIE_SALSA,
  },
  {
    slug: "evento-3",
    fondo: "#1F6F8B",
    acento: "#5FD6A0",
    title: "Clase de salsa para principiantes · semana 2",
    description:
      "Segunda sesión de la serie: repasamos los básicos y sumamos las primeras vueltas. Entrada libre.",
    type: "clase_taller",
    venue_name: "Escuela Swing Latino",
    venue_address: "Carrera 38 # 4-21, San Fernando",
    latitude: 3.4238,
    longitude: -76.5432,
    starts_at: enDiasCali(9, "18:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Escuela Swing Latino",
    whatsapp: "+57 316 555 0202",
    instagram: "swinglatino.cali",
    series_id: SERIE_SALSA,
  },
  {
    slug: "evento-4",
    fondo: "#2C2A4A",
    acento: "#F4A259",
    title: "Cine al aire libre: Cinema Paradiso",
    description:
      "Proyección sobre el césped. Trae cobija o silla; hay venta de comida alrededor. Empieza al oscurecer.",
    type: "cultural",
    venue_name: "Parque del Perro, tarima norte",
    venue_address: "Parque del Perro, San Fernando",
    latitude: 3.421,
    longitude: -76.5447,
    starts_at: enDiasCali(3, "19:30"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Cultura al Parque",
    instagram: "culturaalparque",
    post_url: "https://www.instagram.com/p/Cq9wZfLoTEST/",
  },
  {
    slug: "evento-5",
    fondo: "#4A1942",
    acento: "#FF7B9C",
    title: "Jam de música caleña",
    description:
      "Músicos de la ciudad se turnan la tarima. Si tocas, puedes anotarte en la lista al llegar.",
    type: "musica_en_vivo",
    venue_name: "Kaya Bar",
    venue_address: "Av. 9 Norte # 15-33, Granada",
    latitude: 3.4551,
    longitude: -76.5333,
    starts_at: enDiasCali(diasHastaProximoViernes(), "22:00"),
    duracion: 4,
    is_free: false,
    price: 15000,
    price_label: "Cover $15.000",
    publisher_type: "local",
    publisher_name: "Kaya Bar",
    whatsapp: "+57 317 555 0303",
    instagram: "kayabar.cali",
    tiktok: "kayabar.cali",
    artist_name: "Colectivo Pacífico",
    artist_instagram: "colectivopacifico",
  },
  {
    slug: "evento-6",
    fondo: "#2F6B3A",
    acento: "#FFE066",
    title: "Yoga al amanecer en el parque",
    description:
      "Sesión suave de una hora en el césped. Lleva tu mat o una toalla grande. Cupo limitado.",
    type: "recreativo",
    venue_name: "Parque del Perro, zona central",
    venue_address: "Parque del Perro, San Fernando",
    latitude: 3.4216,
    longitude: -76.5451,
    starts_at: enDiasCali(4, "06:30"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Respira Cali",
    whatsapp: "+57 318 555 0404",
    instagram: "respira.cali",
  },
  {
    slug: "evento-7",
    fondo: "#1D3557",
    acento: "#5FD6A0",
    title: "Torneo relámpago de fútbol-tenis",
    description:
      "Parejas, ronda de grupos y eliminación directa. Inscríbete por WhatsApp antes del viernes.",
    type: "deportivo",
    venue_name: "Polideportivo San Fernando",
    venue_address: "Carrera 40 # 5-20, San Fernando",
    latitude: 3.4225,
    longitude: -76.546,
    starts_at: enDiasCali(6, "09:00"),
    duracion: 5,
    is_free: false,
    price: 12000,
    price_label: "Inscripción $12.000",
    publisher_type: "organizador",
    publisher_name: "Liga Barrial San Fernando",
    whatsapp: "+57 319 555 0505",
  },
  {
    slug: "evento-8",
    fondo: "#6A040F",
    acento: "#FFB627",
    title: "Concierto acústico: trova y son",
    description:
      "Formato íntimo, sin amplificación pesada. Puertas 7:30 p. m., arranca 8:00 p. m. en punto.",
    type: "musica_en_vivo",
    venue_name: "Café Macondo",
    venue_address: "Calle 17 Norte # 8-46, Granada",
    latitude: 3.4548,
    longitude: -76.5344,
    starts_at: enDiasCali(12, "20:00"),
    duracion: 3,
    is_free: false,
    price: 28000,
    price_label: "Cover $28.000",
    publisher_type: "local",
    publisher_name: "Café Macondo",
    instagram: "cafemacondo.cali",
    artist_name: "Dúo Manglar",
    artist_instagram: "duomanglar",
  },
];

// ---------------------------------------------------------------------------
// 4b. 40 eventos de demostración en otras ciudades — 10 por ciudad.
//     Puntos repartidos por zonas conocidas de cada ciudad, mezcla de
//     tipos, mitad gratis / mitad con cover, precios en moneda local,
//     WhatsApp con el indicativo del país y >= 2 series por ciudad.
// ---------------------------------------------------------------------------

// Series recurrentes: el mismo series_id se repite en varias fechas.
const S_VLC_PENA = "5e21e000-0000-4000-8000-00000000b001";
const S_VLC_CUATRO = "5e21e000-0000-4000-8000-00000000b002";
const S_CCS_MANI = "5e21e000-0000-4000-8000-00000000c001";
const S_CCS_SINFO = "5e21e000-0000-4000-8000-00000000c002";
const S_SJO_SINFO = "5e21e000-0000-4000-8000-00000000d001";
const S_SJO_FERIA = "5e21e000-0000-4000-8000-00000000d002";
const S_CAL_TOPA = "5e21e000-0000-4000-8000-00000000e001";
const S_CAL_ESTILO = "5e21e000-0000-4000-8000-00000000e002";

// --- Valencia, Venezuela · +58 · bolívares -------------------------------
// Zonas: La Viña, Av. Bolívar Norte, San Blas, Prebo, centro histórico,
// Parque Recreacional Sur, Naguanagua.
const valencia = [
  {
    slug: "valencia-1",
    city: "Valencia",
    fondo: "#6A040F",
    acento: "#FFB627",
    title: "Noche de salsa casino en La Viña",
    description:
      "Orquesta en vivo y pista abierta hasta la madrugada en pleno corazón de La Viña.",
    type: "musica_en_vivo",
    venue_name: "Bar La Guaracha",
    venue_address: "Calle 143 con Av. Bolívar Norte, La Viña",
    latitude: 10.1866,
    longitude: -67.9975,
    starts_at: enDiasCali(1, "22:00"),
    duracion: 4,
    is_free: false,
    price: 250,
    price_label: "Cover Bs. 250",
    publisher_type: "local",
    publisher_name: "Bar La Guaracha",
    whatsapp: "+58 412 555 0110",
    instagram: "laguaracha.vln",
    post_url: "https://www.instagram.com/p/CvVln01SEED/",
  },
  {
    slug: "valencia-2",
    city: "Valencia",
    fondo: "#143601",
    acento: "#B5E48C",
    title: "Peña criolla: gaita y tambor",
    description:
      "Cultores del tambor de Carabobo y gaita oriental. Entrada libre, se agradece la colaboración.",
    type: "musica_en_vivo",
    venue_name: "Ateneo de Valencia",
    venue_address: "Av. Bolívar Norte, sector Ateneo",
    latitude: 10.198,
    longitude: -68.0028,
    starts_at: enDiasCali(4, "19:00"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Ateneo de Valencia",
    whatsapp: "+58 414 555 0111",
    instagram: "ateneodevalencia",
    series_id: S_VLC_PENA,
  },
  {
    slug: "valencia-3",
    city: "Valencia",
    fondo: "#1B4332",
    acento: "#95D5B2",
    title: "Peña criolla: joropo y bandola",
    description:
      "Segunda fecha de la peña: joropo central con arpa, cuatro y maracas. Entrada libre.",
    type: "musica_en_vivo",
    venue_name: "Ateneo de Valencia",
    venue_address: "Av. Bolívar Norte, sector Ateneo",
    latitude: 10.198,
    longitude: -68.0028,
    starts_at: enDiasCali(11, "19:00"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Ateneo de Valencia",
    whatsapp: "+58 414 555 0111",
    instagram: "ateneodevalencia",
    series_id: S_VLC_PENA,
  },
  {
    slug: "valencia-4",
    city: "Valencia",
    fondo: "#1F6F8B",
    acento: "#FFD166",
    title: "Taller de cuatro venezolano · nivel 1",
    description:
      "Primeros golpes y afinación. Hay cuatros para prestar, pero mejor si traes el tuyo.",
    type: "clase_taller",
    venue_name: "Casa de la Cultura de Valencia",
    venue_address: "Calle Colombia, San Blas",
    latitude: 10.1789,
    longitude: -68.0004,
    starts_at: enDiasCali(3, "17:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Casa de la Cultura de Valencia",
    whatsapp: "+58 424 555 0112",
    series_id: S_VLC_CUATRO,
  },
  {
    slug: "valencia-5",
    city: "Valencia",
    fondo: "#1F6F8B",
    acento: "#5FD6A0",
    title: "Taller de cuatro venezolano · nivel 1 (sesión 2)",
    description:
      "Seguimos con el charrasqueo y los primeros acompañamientos de merengue y vals.",
    type: "clase_taller",
    venue_name: "Casa de la Cultura de Valencia",
    venue_address: "Calle Colombia, San Blas",
    latitude: 10.1789,
    longitude: -68.0004,
    starts_at: enDiasCali(10, "17:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Casa de la Cultura de Valencia",
    whatsapp: "+58 424 555 0112",
    series_id: S_VLC_CUATRO,
  },
  {
    slug: "valencia-6",
    city: "Valencia",
    fondo: "#4A1942",
    acento: "#FF7B9C",
    title: "Clínica de percusión afrovenezolana",
    description:
      "Culo'e puya y tambor cumaco con percusionistas de la región. Cupo limitado a 20 personas.",
    type: "clase_taller",
    venue_name: "Conservatorio Sebastián Echeverría Lozano",
    venue_address: "Prebo I, Valencia",
    latitude: 10.1783,
    longitude: -68.0091,
    starts_at: enDiasCali(7, "18:00"),
    duracion: 2,
    is_free: false,
    price: 120,
    price_label: "Entrada Bs. 120",
    publisher_type: "organizador",
    publisher_name: "Colectivo Tambor",
    whatsapp: "+58 416 555 0113",
    instagram: "colectivotambor.vln",
    post_url: "https://www.instagram.com/p/CvVln06SEED/",
  },
  {
    slug: "valencia-7",
    city: "Valencia",
    fondo: "#2C2A4A",
    acento: "#F4A259",
    title: "Feria del libro de Carabobo",
    description:
      "Editoriales independientes, firmas de autores y lecturas al aire libre. Entrada libre todo el día.",
    type: "cultural",
    venue_name: "Plaza de los Enanitos",
    venue_address: "Urbanización La Alegría, Valencia",
    latitude: 10.1799,
    longitude: -68.0064,
    starts_at: enDiasCali(6, "16:00"),
    duracion: 6,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Secretaría de Cultura de Carabobo",
    instagram: "culturacarabobo",
    post_url: "https://www.instagram.com/p/CvVln07SEED/",
  },
  {
    slug: "valencia-8",
    city: "Valencia",
    fondo: "#14213D",
    acento: "#FCA311",
    title: "Cine foro: nuevo cine venezolano",
    description:
      "Proyección y conversatorio con realizadores locales. Después hay vino y picadera.",
    type: "cultural",
    venue_name: "Museo de Arte e Historia Casa de la Estrella",
    venue_address: "Calle Comercio, centro histórico",
    latitude: 10.1746,
    longitude: -68.0056,
    starts_at: enDiasCali(9, "18:30"),
    duracion: 3,
    is_free: false,
    price: 80,
    price_label: "Entrada Bs. 80",
    publisher_type: "organizador",
    publisher_name: "Cinemateca de Valencia",
    whatsapp: "+58 412 555 0114",
  },
  {
    slug: "valencia-9",
    city: "Valencia",
    fondo: "#2F6B3A",
    acento: "#FFE066",
    title: "Bailoterapia al aire libre",
    description:
      "Una hora de ritmo latino para arrancar el día. Lleva agua y una toalla.",
    type: "recreativo",
    venue_name: "Parque Recreacional Sur",
    venue_address: "Av. Aranzazu, sur de Valencia",
    latitude: 10.1557,
    longitude: -67.9989,
    starts_at: enDiasCali(2, "07:00"),
    duracion: 2,
    is_free: false,
    price: 60,
    price_label: "Aporte Bs. 60",
    publisher_type: "organizador",
    publisher_name: "Parque Sur en Movimiento",
    whatsapp: "+58 414 555 0115",
    instagram: "parquesur.vln",
  },
  {
    slug: "valencia-10",
    city: "Valencia",
    fondo: "#1D3557",
    acento: "#5FD6A0",
    title: "Torneo de kickingball femenino",
    description:
      "Ronda de grupos y eliminación directa. Inscribe a tu equipo por WhatsApp antes del jueves.",
    type: "deportivo",
    venue_name: "Polideportivo Misael Delgado",
    venue_address: "Av. Las Ferias, Valencia",
    latitude: 10.189,
    longitude: -68.0164,
    starts_at: enDiasCali(13, "09:00"),
    duracion: 5,
    is_free: false,
    price: 150,
    price_label: "Inscripción Bs. 150",
    publisher_type: "organizador",
    publisher_name: "Liga Carabobeña de Kickingball",
    whatsapp: "+58 424 555 0116",
  },
];

// --- Caracas, Venezuela · +58 · bolívares -------------------------------
// Zonas: Sabana Grande, Los Caobos, Los Chorros, Chacao, Los Palos Grandes,
// La Castellana, Parque del Este, El Ávila.
const caracas = [
  {
    slug: "caracas-1",
    city: "Caracas",
    fondo: "#B8232F",
    acento: "#FFB627",
    title: "Salsa brava en El Maní",
    description:
      "El templo de la salsa caraqueña: son montuno y descarga en vivo hasta tarde.",
    type: "musica_en_vivo",
    venue_name: "El Maní es Así",
    venue_address: "Av. Francisco Solano López, Sabana Grande",
    latitude: 10.4917,
    longitude: -66.8707,
    starts_at: enDiasCali(2, "21:30"),
    duracion: 4,
    is_free: false,
    price: 300,
    price_label: "Cover Bs. 300",
    publisher_type: "local",
    publisher_name: "El Maní es Así",
    whatsapp: "+58 412 555 0120",
    instagram: "elmaniesasi",
    post_url: "https://www.instagram.com/p/CvCcs01SEED/",
    series_id: S_CCS_MANI,
  },
  {
    slug: "caracas-2",
    city: "Caracas",
    fondo: "#6A040F",
    acento: "#FFD166",
    title: "Salsa brava en El Maní",
    description:
      "Segunda fecha con orquesta invitada. Llega temprano si quieres mesa cerca de la tarima.",
    type: "musica_en_vivo",
    venue_name: "El Maní es Así",
    venue_address: "Av. Francisco Solano López, Sabana Grande",
    latitude: 10.4917,
    longitude: -66.8707,
    starts_at: enDiasCali(9, "21:30"),
    duracion: 4,
    is_free: false,
    price: 300,
    price_label: "Cover Bs. 300",
    publisher_type: "local",
    publisher_name: "El Maní es Así",
    whatsapp: "+58 412 555 0120",
    instagram: "elmaniesasi",
    series_id: S_CCS_MANI,
  },
  {
    slug: "caracas-3",
    city: "Caracas",
    fondo: "#1B4332",
    acento: "#95D5B2",
    title: "Retreta de la Sinfónica en Los Caobos",
    description:
      "Concierto gratuito de la orquesta en la concha acústica. Lleva manta para sentarte en el césped.",
    type: "cultural",
    venue_name: "Parque Los Caobos, concha acústica",
    venue_address: "Bellas Artes, Caracas",
    latitude: 10.4968,
    longitude: -66.8792,
    starts_at: enDiasCali(5, "11:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Sistema Nacional de Orquestas",
    instagram: "elsistema",
    series_id: S_CCS_SINFO,
  },
  {
    slug: "caracas-4",
    city: "Caracas",
    fondo: "#143601",
    acento: "#B5E48C",
    title: "Retreta de la Sinfónica en Los Caobos",
    description:
      "Segunda retreta del ciclo, esta vez con programa de compositores venezolanos. Entrada libre.",
    type: "cultural",
    venue_name: "Parque Los Caobos, concha acústica",
    venue_address: "Bellas Artes, Caracas",
    latitude: 10.4968,
    longitude: -66.8792,
    starts_at: enDiasCali(12, "11:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Sistema Nacional de Orquestas",
    instagram: "elsistema",
    series_id: S_CCS_SINFO,
  },
  {
    slug: "caracas-5",
    city: "Caracas",
    fondo: "#22223B",
    acento: "#C9ADA7",
    title: "Jazz en Los Galpones",
    description:
      "Cuarteto de jazz en el patio del centro de arte, entre galerías y tiendas de diseño.",
    type: "musica_en_vivo",
    venue_name: "Centro de Arte Los Galpones",
    venue_address: "Av. Ávila, Los Chorros",
    latitude: 10.501,
    longitude: -66.833,
    starts_at: enDiasCali(4, "20:00"),
    duracion: 3,
    is_free: false,
    price: 220,
    price_label: "Cover Bs. 220",
    publisher_type: "local",
    publisher_name: "Centro de Arte Los Galpones",
    whatsapp: "+58 414 555 0121",
    instagram: "artelosgalpones",
    post_url: "https://www.instagram.com/p/CvCcs05SEED/",
  },
  {
    slug: "caracas-6",
    city: "Caracas",
    fondo: "#3D348B",
    acento: "#7678ED",
    title: "Taller de serigrafía",
    description:
      "Estampa tu propia camiseta o afiche. Los materiales van incluidos; sal con dos piezas hechas.",
    type: "clase_taller",
    venue_name: "Centro Cultural La Estancia",
    venue_address: "Av. Francisco de Miranda, Chacao",
    latitude: 10.496,
    longitude: -66.856,
    starts_at: enDiasCali(6, "15:00"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Centro Cultural La Estancia",
    whatsapp: "+58 424 555 0122",
  },
  {
    slug: "caracas-7",
    city: "Caracas",
    fondo: "#0B525B",
    acento: "#FFA400",
    title: "Clase de casino caraqueño",
    description:
      "Rueda de casino al aire libre en la plaza. No necesitas pareja ni experiencia previa.",
    type: "clase_taller",
    venue_name: "Plaza Los Palos Grandes",
    venue_address: "4ª Av. con 3ª transversal, Los Palos Grandes",
    latitude: 10.5016,
    longitude: -66.8432,
    starts_at: enDiasCali(3, "18:00"),
    duracion: 2,
    is_free: false,
    price: 100,
    price_label: "Entrada Bs. 100",
    publisher_type: "organizador",
    publisher_name: "Casino Caracas",
    whatsapp: "+58 416 555 0123",
    instagram: "casinocaracas",
  },
  {
    slug: "caracas-8",
    city: "Caracas",
    fondo: "#14213D",
    acento: "#FCA311",
    title: "Ciclopaseo nocturno por Las Mercedes",
    description:
      "Recorrido tranquilo de 15 km con acompañamiento. Punto de encuentro en la Plaza La Castellana.",
    type: "recreativo",
    venue_name: "Plaza La Castellana",
    venue_address: "Av. Principal de La Castellana, Chacao",
    latitude: 10.4977,
    longitude: -66.8531,
    starts_at: enDiasCali(8, "19:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Caracas Rueda Libre",
    instagram: "caracasruedalibre",
    post_url: "https://www.instagram.com/p/CvCcs08SEED/",
  },
  {
    slug: "caracas-9",
    city: "Caracas",
    fondo: "#1B4332",
    acento: "#FFE066",
    title: "Tarde de juegos de mesa en el Parque del Este",
    description:
      "Ludoteca abierta con más de 60 títulos y monitores para explicar reglas. Ideal para ir en familia.",
    type: "recreativo",
    venue_name: "Parque Generalísimo Francisco de Miranda",
    venue_address: "Parque del Este, Altamira",
    latitude: 10.4956,
    longitude: -66.8371,
    starts_at: enDiasCali(10, "16:00"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Ludoteca Caracas",
    whatsapp: "+58 412 555 0124",
  },
  {
    slug: "caracas-10",
    city: "Caracas",
    fondo: "#2F6B3A",
    acento: "#B5E48C",
    title: "Subida al Ávila por Sabas Nieves",
    description:
      "Caminata guiada hasta Sabas Nieves al amanecer. Ritmo moderado; devuélvete cuando quieras.",
    type: "deportivo",
    venue_name: "Puesto de guardaparques Sabas Nieves",
    venue_address: "Final de Av. Boyacá, Altamira",
    latitude: 10.5115,
    longitude: -66.849,
    starts_at: enDiasCali(14, "06:30"),
    duracion: 4,
    is_free: false,
    price: 90,
    price_label: "Aporte guía Bs. 90",
    publisher_type: "organizador",
    publisher_name: "Ávila Trekking",
    whatsapp: "+58 414 555 0125",
    instagram: "avilatrekking",
  },
];

// --- San José, Costa Rica · +506 · colones ------------------------------
// Zonas: Barrio Escalante, centro (Teatro Nacional), Barrio Aranjuez y
// Otoya, Parque España, Plaza de la Democracia, La Sabana.
const sanJose = [
  {
    slug: "san-jose-1",
    city: "San José",
    fondo: "#14213D",
    acento: "#FCA311",
    title: "Noche de jazz tico",
    description:
      "Trío de jazz costarricense con estándares y composiciones propias. Dos sets, sin intermedio largo.",
    type: "musica_en_vivo",
    venue_name: "Jazz Café Escalante",
    venue_address: "Calle 33, Barrio Escalante",
    latitude: 9.933,
    longitude: -84.0668,
    starts_at: enDiasCali(1, "21:00"),
    duracion: 3,
    is_free: false,
    price: 6000,
    price_label: "Entrada ₡6.000",
    publisher_type: "local",
    publisher_name: "Jazz Café Escalante",
    whatsapp: "+506 8555 0130",
    instagram: "jazzcafecr",
    post_url: "https://www.instagram.com/p/CvSjo01SEED/",
  },
  {
    slug: "san-jose-2",
    city: "San José",
    fondo: "#6A040F",
    acento: "#FFB627",
    title: "Orquesta Sinfónica Nacional",
    description:
      "Programa sinfónico en la sala principal del Teatro Nacional. Puertas 7:30 p. m.",
    type: "musica_en_vivo",
    venue_name: "Teatro Nacional de Costa Rica",
    venue_address: "Avenida 2, calles 3 y 5, San José centro",
    latitude: 9.9333,
    longitude: -84.0783,
    starts_at: enDiasCali(5, "20:00"),
    duracion: 2,
    is_free: false,
    price: 5000,
    price_label: "Luneta ₡5.000",
    publisher_type: "organizador",
    publisher_name: "Centro Nacional de la Música",
    instagram: "osncostarica",
    series_id: S_SJO_SINFO,
  },
  {
    slug: "san-jose-3",
    city: "San José",
    fondo: "#641220",
    acento: "#F9C74F",
    title: "Orquesta Sinfónica Nacional",
    description:
      "Segundo concierto del ciclo, con solista invitado de piano. Mismo horario y sala.",
    type: "musica_en_vivo",
    venue_name: "Teatro Nacional de Costa Rica",
    venue_address: "Avenida 2, calles 3 y 5, San José centro",
    latitude: 9.9333,
    longitude: -84.0783,
    starts_at: enDiasCali(12, "20:00"),
    duracion: 2,
    is_free: false,
    price: 5000,
    price_label: "Luneta ₡5.000",
    publisher_type: "organizador",
    publisher_name: "Centro Nacional de la Música",
    instagram: "osncostarica",
    series_id: S_SJO_SINFO,
  },
  {
    slug: "san-jose-4",
    city: "San José",
    fondo: "#2F6B3A",
    acento: "#FFE066",
    title: "Feria Verde de Aranjuez",
    description:
      "Feria orgánica de productores: café, cacao, pan de masa madre y hortalizas. Entrada libre.",
    type: "recreativo",
    venue_name: "Polideportivo de Aranjuez",
    venue_address: "Barrio Aranjuez, San José",
    latitude: 9.9394,
    longitude: -84.0716,
    starts_at: enDiasCali(3, "07:00"),
    duracion: 5,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Feria Verde",
    whatsapp: "+506 8555 0135",
    instagram: "feriaverde",
    post_url: "https://www.instagram.com/p/CvSjo04SEED/",
    series_id: S_SJO_FERIA,
  },
  {
    slug: "san-jose-5",
    city: "San José",
    fondo: "#1B4332",
    acento: "#B5E48C",
    title: "Feria Verde de Aranjuez",
    description:
      "Nueva edición semanal con food trucks y música en vivo por la mañana. Lleva bolsa reutilizable.",
    type: "recreativo",
    venue_name: "Polideportivo de Aranjuez",
    venue_address: "Barrio Aranjuez, San José",
    latitude: 9.9394,
    longitude: -84.0716,
    starts_at: enDiasCali(10, "07:00"),
    duracion: 5,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Feria Verde",
    whatsapp: "+506 8555 0135",
    instagram: "feriaverde",
    series_id: S_SJO_FERIA,
  },
  {
    slug: "san-jose-6",
    city: "San José",
    fondo: "#5F0F40",
    acento: "#FB8B24",
    title: "Taller de cerámica chorotega",
    description:
      "Modelado a mano con técnicas de Guaitil. Trae ropa que se pueda manchar; la arcilla va incluida.",
    type: "clase_taller",
    venue_name: "Casa del Cuño, CENAC",
    venue_address: "Antigua Fábrica Nacional de Licores, Barrio Otoya",
    latitude: 9.935,
    longitude: -84.074,
    starts_at: enDiasCali(6, "16:00"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "CENAC Talleres",
    whatsapp: "+506 8555 0131",
  },
  {
    slug: "san-jose-7",
    city: "San José",
    fondo: "#0B525B",
    acento: "#FFA400",
    title: "Clase abierta de swing criollo",
    description:
      "El baile nacional de Costa Rica, paso a paso, en el kiosco del parque. Gratis y sin pareja también se puede.",
    type: "clase_taller",
    venue_name: "Parque España",
    venue_address: "Avenida 7, calles 9 y 11, San José",
    latitude: 9.9345,
    longitude: -84.0755,
    starts_at: enDiasCali(4, "18:30"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Swing Criollo CR",
    whatsapp: "+506 8555 0133",
    instagram: "swingcriollocr",
  },
  {
    slug: "san-jose-8",
    city: "San José",
    fondo: "#22223B",
    acento: "#C9ADA7",
    title: "Cuentacuentos y club de lectura",
    description:
      "Lectura en voz alta para adultos y conversación sobre el libro del mes. Café de cortesía.",
    type: "cultural",
    venue_name: "Casa Verde de Amón",
    venue_address: "Calle 3 con Avenida 9, Barrio Amón",
    latitude: 9.9388,
    longitude: -84.0772,
    starts_at: enDiasCali(7, "17:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Club de Lectura Amón",
    whatsapp: "+506 8555 0134",
    instagram: "clubdelecturamon",
  },
  {
    slug: "san-jose-9",
    city: "San José",
    fondo: "#1D3557",
    acento: "#5FD6A0",
    title: "Museo de noche: jade y precolombino",
    description:
      "Recorrido guiado tras el cierre, con la colección de jade iluminada. Cupo por tanda.",
    type: "cultural",
    venue_name: "Museo del Jade y de la Cultura Precolombina",
    venue_address: "Plaza de la Democracia, San José centro",
    latitude: 9.9328,
    longitude: -84.0745,
    starts_at: enDiasCali(9, "18:00"),
    duracion: 3,
    is_free: false,
    price: 4000,
    price_label: "Entrada ₡4.000",
    publisher_type: "organizador",
    publisher_name: "Museo del Jade",
    whatsapp: "+506 8555 0136",
    instagram: "museodeljade",
    post_url: "https://www.instagram.com/p/CvSjo09SEED/",
  },
  {
    slug: "san-jose-10",
    city: "San José",
    fondo: "#143601",
    acento: "#95D5B2",
    title: "Mejenga de fútbol 5 en La Sabana",
    description:
      "Partidos de 20 minutos, se arman equipos al llegar. Canchas del costado norte del parque.",
    type: "deportivo",
    venue_name: "Parque Metropolitano La Sabana",
    venue_address: "Costado norte, canchas multiuso",
    latitude: 9.937,
    longitude: -84.098,
    starts_at: enDiasCali(13, "17:00"),
    duracion: 2,
    is_free: false,
    price: 3000,
    price_label: "Cancha ₡3.000",
    publisher_type: "organizador",
    publisher_name: "Mejengas SJO",
    whatsapp: "+506 8555 0132",
  },
];

// --- Cali, Colombia · +57 · pesos --------------------------------------
// Zonas nuevas: El Peñón, San Antonio, Barrio Obrero, Alameda (Calle 5),
// Loma de la Cruz, El Bosque.
const caliNuevo = [
  {
    slug: "cali-9",
    city: "Cali",
    fondo: "#B8232F",
    acento: "#FFB627",
    title: "Viernes de salsa en La Topa Tolondra",
    description:
      "Salsa dura sin parar y colección de vinilos entre canción y canción. El clásico de la Alameda.",
    type: "musica_en_vivo",
    venue_name: "La Topa Tolondra",
    venue_address: "Calle 5 # 13-27, Barrio Alameda",
    latitude: 3.4331,
    longitude: -76.5372,
    starts_at: enDiasCali(diasHastaProximoViernes(), "21:00"),
    duracion: 5,
    is_free: false,
    price: 20000,
    price_label: "Cover $20.000",
    publisher_type: "local",
    publisher_name: "La Topa Tolondra",
    whatsapp: "+57 315 555 0140",
    instagram: "latopatolondra",
    post_url: "https://www.instagram.com/p/CvCal09SEED/",
    series_id: S_CAL_TOPA,
  },
  {
    slug: "cali-10",
    city: "Cali",
    fondo: "#6A040F",
    acento: "#FFD166",
    title: "Viernes de salsa en La Topa Tolondra",
    description:
      "Segunda fecha de la serie, con set de salsa brava de Nueva York y Puerto Rico.",
    type: "musica_en_vivo",
    venue_name: "La Topa Tolondra",
    venue_address: "Calle 5 # 13-27, Barrio Alameda",
    latitude: 3.4331,
    longitude: -76.5372,
    starts_at: enDiasCali(diasHastaProximoViernes() + 7, "21:00"),
    duracion: 5,
    is_free: false,
    price: 20000,
    price_label: "Cover $20.000",
    publisher_type: "local",
    publisher_name: "La Topa Tolondra",
    whatsapp: "+57 315 555 0140",
    instagram: "latopatolondra",
    series_id: S_CAL_TOPA,
  },
  {
    slug: "cali-11",
    city: "Cali",
    fondo: "#4A1942",
    acento: "#FF7B9C",
    title: "Son y boogaloo en Tin Tin Deo",
    description:
      "Noche de boogaloo, pachanga y salsa de los sesenta con DJ y banda invitada.",
    type: "musica_en_vivo",
    venue_name: "Tin Tin Deo",
    venue_address: "Calle 5 # 38-71, San Fernando",
    latitude: 3.4222,
    longitude: -76.5432,
    starts_at: enDiasCali(5, "22:00"),
    duracion: 4,
    is_free: false,
    price: 18000,
    price_label: "Cover $18.000",
    publisher_type: "local",
    publisher_name: "Tin Tin Deo",
    whatsapp: "+57 316 555 0141",
    instagram: "tintindeocali",
  },
  {
    slug: "cali-12",
    city: "Cali",
    fondo: "#2C2A4A",
    acento: "#F4A259",
    title: "Exposición: gráfica del Pacífico",
    description:
      "Muestra de grabado y cartel de artistas del litoral, abierta todo el día en el museo.",
    type: "cultural",
    venue_name: "Museo La Tertulia",
    venue_address: "Av. Colombia # 5-105 Oeste, El Peñón",
    latitude: 3.4519,
    longitude: -76.5407,
    starts_at: enDiasCali(6, "10:00"),
    duracion: 8,
    is_free: false,
    price: 12000,
    price_label: "Entrada $12.000",
    publisher_type: "organizador",
    publisher_name: "Museo La Tertulia",
    instagram: "museolatertulia",
    post_url: "https://www.instagram.com/p/CvCal12SEED/",
  },
  {
    slug: "cali-13",
    city: "Cali",
    fondo: "#14213D",
    acento: "#FCA311",
    title: "Recorrido patrimonial por San Antonio",
    description:
      "Caminata guiada por las casas de bahareque, el teatro y la colina. Punto de salida en la iglesia.",
    type: "cultural",
    venue_name: "Iglesia de San Antonio",
    venue_address: "Colina de San Antonio, Cali",
    latitude: 3.4487,
    longitude: -76.5382,
    starts_at: enDiasCali(8, "16:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Cali Camina",
    instagram: "calicamina",
  },
  {
    slug: "cali-14",
    city: "Cali",
    fondo: "#1F6F8B",
    acento: "#FFD166",
    title: "Clase de salsa estilo caleño",
    description:
      "Paso caleño rápido, con trabajo de pies y musicalidad. Nivel básico, no necesitas pareja.",
    type: "clase_taller",
    venue_name: "Salón Arrebato",
    venue_address: "Carrera 12 # 24-30, Barrio Obrero",
    latitude: 3.4361,
    longitude: -76.5212,
    starts_at: enDiasCali(2, "17:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Arrebato Caleño",
    whatsapp: "+57 317 555 0142",
    instagram: "arrebatocaleno",
    series_id: S_CAL_ESTILO,
  },
  {
    slug: "cali-15",
    city: "Cali",
    fondo: "#1F6F8B",
    acento: "#5FD6A0",
    title: "Clase de salsa estilo caleño (sesión 2)",
    description:
      "Seguimos con figuras de pareja y una pequeña coreografía para cerrar la serie.",
    type: "clase_taller",
    venue_name: "Salón Arrebato",
    venue_address: "Carrera 12 # 24-30, Barrio Obrero",
    latitude: 3.4361,
    longitude: -76.5212,
    starts_at: enDiasCali(9, "17:00"),
    duracion: 2,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Arrebato Caleño",
    whatsapp: "+57 317 555 0142",
    instagram: "arrebatocaleno",
    series_id: S_CAL_ESTILO,
  },
  {
    slug: "cali-16",
    city: "Cali",
    fondo: "#2F6B3A",
    acento: "#FFE066",
    title: "Cine al parque: cine colombiano",
    description:
      "Proyección al aire libre en la Loma de la Cruz. Trae silla o cobija; empieza al oscurecer.",
    type: "recreativo",
    venue_name: "Loma de la Cruz",
    venue_address: "Calle 5 con Carrera 16, Cali",
    latitude: 3.447,
    longitude: -76.541,
    starts_at: enDiasCali(4, "18:30"),
    duracion: 3,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Cinemateca La Tertulia",
    instagram: "cinematecalatertulia",
  },
  {
    slug: "cali-17",
    city: "Cali",
    fondo: "#22223B",
    acento: "#C9ADA7",
    title: "Mercado de las pulgas de San Antonio",
    description:
      "Vinilos, ropa vintage, libros y objetos de segunda mano alrededor del parque toda la mañana.",
    type: "recreativo",
    venue_name: "Parque de San Antonio",
    venue_address: "Carrera 10 con Calle 3 Oeste, Cali",
    latitude: 3.449,
    longitude: -76.5378,
    starts_at: enDiasCali(7, "09:00"),
    duracion: 6,
    is_free: true,
    publisher_type: "organizador",
    publisher_name: "Pulgas San Antonio",
    instagram: "pulgassanantonio",
    post_url: "https://www.instagram.com/p/CvCal17SEED/",
  },
  {
    slug: "cali-18",
    city: "Cali",
    fondo: "#1D3557",
    acento: "#5FD6A0",
    title: "Torneo de minitejo",
    description:
      "Parejas, ronda de grupos y final. Hay cerveza fría y empanadas; inscribe por WhatsApp.",
    type: "deportivo",
    venue_name: "Cancha de tejo El Bosque",
    venue_address: "Barrio El Bosque, Cali",
    latitude: 3.4472,
    longitude: -76.5471,
    starts_at: enDiasCali(13, "15:00"),
    duracion: 5,
    is_free: false,
    price: 10000,
    price_label: "Inscripción $10.000",
    publisher_type: "organizador",
    publisher_name: "Liga Vallecaucana de Tejo",
    whatsapp: "+57 318 555 0143",
  },
];

base.push(...valencia, ...caracas, ...sanJose, ...caliNuevo);

// UUID estable por evento (posición en `base`; no reordenar entre corridas).
const eventos = base.map((e, i) => ({
  ...e,
  id: `5eede000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`,
}));

// ---------------------------------------------------------------------------
// 5. Modo --png: genera los flyers en disco y termina
// ---------------------------------------------------------------------------
if (modo === "--png") {
  const dir = new URL("scripts/flyers-prueba/", RAIZ);
  mkdirSync(dir, { recursive: true });
  for (const e of eventos) {
    const ruta = new URL(`${e.slug}.png`, dir);
    writeFileSync(ruta, flyerPng(e.fondo, e.acento));
    console.log("escrito", `scripts/flyers-prueba/${e.slug}.png`);
  }
  console.log(`\nListo: ${eventos.length} PNG generados. No se tocó Supabase.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 6. A partir de aquí se necesita la service_role key
// ---------------------------------------------------------------------------
if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error(
    [
      "Falta configuración en .env.local:",
      `  NEXT_PUBLIC_SUPABASE_URL     ${URL_SUPABASE ? "ok" : "FALTA"}`,
      `  SUPABASE_SERVICE_ROLE_KEY    ${SERVICE_KEY ? "ok" : "FALTA"}`,
      "",
      "Saca la service_role del panel de Supabase (Project Settings > API).",
      "No uses el prefijo NEXT_PUBLIC_ para esa llave.",
      "",
      "Si solo quieres ver los flyers de prueba sin tocar la base:",
      "  node scripts/seed-eventos.mjs --png",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { persistSession: false },
});

const rutasFlyer = eventos.map((e) => `${CARPETA}/${e.slug}.png`);

// ---------------------------------------------------------------------------
// 7. Modo --limpiar
// ---------------------------------------------------------------------------
if (modo === "--limpiar") {
  const { error: e1 } = await supabase
    .from("events")
    .delete()
    .in(
      "id",
      eventos.map((e) => e.id),
    );
  if (e1) {
    console.error("Error borrando eventos:", e1.message);
    process.exit(1);
  }
  const { error: e2 } = await supabase.storage.from(BUCKET).remove(rutasFlyer);
  if (e2) console.warn("Aviso al borrar flyers:", e2.message);
  console.log(
    `Listo: ${eventos.length} eventos de prueba y sus flyers eliminados.`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 8. Subir flyers al bucket
// ---------------------------------------------------------------------------
console.log("Subiendo flyers a", `${BUCKET}/${CARPETA}/ ...`);
for (const e of eventos) {
  const png = flyerPng(e.fondo, e.acento);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${CARPETA}/${e.slug}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    console.error(`  ${e.slug}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${e.slug}.png ok`);
}

const urlPublica = (slug) =>
  `${URL_SUPABASE}/storage/v1/object/public/${BUCKET}/${CARPETA}/${slug}.png`;

// ---------------------------------------------------------------------------
// 9. Insertar / actualizar los eventos
// ---------------------------------------------------------------------------
const ahora = new Date().toISOString();
const filas = eventos.map((e) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  type: e.type,
  cover_url: urlPublica(e.slug),
  venue_name: e.venue_name,
  venue_address: e.venue_address,
  latitude: e.latitude,
  longitude: e.longitude,
  starts_at: e.starts_at.toISOString(),
  ends_at: masHoras(e.starts_at, e.duracion).toISOString(),
  is_free: e.is_free,
  price: e.price ?? null,
  price_label: e.price_label ?? null,
  status: "aprobado",
  reviewed_at: ahora,
  publisher_type: e.publisher_type ?? null,
  publisher_name: e.publisher_name ?? null,
  whatsapp: e.whatsapp ?? null,
  instagram: e.instagram ?? null,
  tiktok: e.tiktok ?? null,
  post_url: e.post_url ?? null,
  artist_name: e.artist_name ?? null,
  artist_instagram: e.artist_instagram ?? null,
  series_id: e.series_id ?? null,
  city: e.city ?? "Cali",
}));

const { data, error } = await supabase
  .from("events")
  .upsert(filas, { onConflict: "id" })
  .select("id, title, starts_at, is_free, series_id");

if (error) {
  console.error("Error insertando eventos:", error.message);
  process.exit(1);
}

console.log(`\n${data.length} eventos 'aprobado' insertados/actualizados:`);
for (const r of data.sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
  const etiqueta = r.is_free ? "gratis" : "con cover";
  const serie = r.series_id ? " · serie" : "";
  console.log(`  ${r.starts_at.slice(0, 16).replace("T", " ")}  ${etiqueta}${serie}  ${r.title}`);
}
console.log("\nAbre / y /lista: las tarjetas ya deberían salir con flyer.");
