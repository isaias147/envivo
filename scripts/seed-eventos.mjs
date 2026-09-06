#!/usr/bin/env node
/*
 * EnVivo · datos de prueba
 * -------------------------------------------------------------------------
 * Inserta 8 eventos en Cali con estado 'aprobado' (Granada y San Fernando,
 * coordenadas reales) y sube un flyer de prueba por evento al bucket `flyers`,
 * para que las tarjetas del mapa y la lista no salgan sin imagen.
 *
 *   node scripts/seed-eventos.mjs            inserta / actualiza los 8 eventos
 *   node scripts/seed-eventos.mjs --limpiar  borra esos 8 eventos y sus flyers
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
// 4. Los 8 eventos
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

// UUID estable por evento (para poder re-ejecutar sin duplicar).
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
  console.log("\nListo: 8 PNG generados. No se tocó Supabase.");
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
  console.log("Listo: 8 eventos de prueba y sus flyers eliminados.");
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
  city: "Cali",
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
