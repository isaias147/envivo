"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCuentaPublicador } from "@/lib/cuentaPublicador";
import {
  dentroDeCaja,
  GRANADA_CALI,
  leerFiltro,
  leerPrecio,
  pasaPrecio,
  queryFiltros,
  RADIOS_KM,
  rangoFiltro,
  type EventoPublico,
  type Filtro,
  type Precio,
  type RadioKm,
} from "@/lib/eventos";
import TarjetaEvento from "@/components/TarjetaEvento";
import TarjetaLugar from "@/components/TarjetaLugar";
import Buscador from "@/components/Buscador";
import BarraInferior from "@/components/BarraInferior";
import EnlaceCuenta from "@/components/EnlaceCuenta";
import { TILES_ATRIBUCION } from "@/lib/mapaTiles";
import type { ResultadoBusqueda } from "@/lib/busqueda";
import styles from "./page.module.css";

// El mapa se carga solo en el navegador (Leaflet necesita `window`).
const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
  { id: "proximos", etiqueta: "Próximos" },
];

// Etiquetas del filtro de precio (el tipo y la lógica viven en lib/eventos).
const PRECIOS: { id: Precio; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "gratis", etiqueta: "Gratis" },
  { id: "cover", etiqueta: "Con cover" },
];

// `useSearchParams` obliga a un límite de Suspense en la página.
export default function Home() {
  return (
    <Suspense fallback={<div className={styles.mapaCargando}>Cargando…</div>}>
      <MapaPantalla />
    </Suspense>
  );
}

function MapaPantalla() {
  const sp = useSearchParams();
  // Publicadores registrados (cuenta de Google con perfil, ver
  // lib/cuentaPublicador.ts): les mostramos el atajo a publicar. Para el
  // usuario final (sin perfil) el mapa queda idéntico a como estaba.
  const { perfil: perfilPublicador } = useCuentaPublicador();
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Filtros iniciales desde la URL (?t=&p=), para conservarlos al venir
  // de /lista. El radio es propio del mapa y no se comparte.
  const [filtro, setFiltro] = useState<Filtro>(() => leerFiltro(sp.get("t")));
  const [precio, setPrecio] = useState<Precio>(() => leerPrecio(sp.get("p")));
  // ?resaltar=&tipo=, leídos UNA sola vez al montar: el efecto que sincroniza
  // ?t=&p= en la URL (más abajo) reemplaza el historial apenas se monta y
  // los borraría si los leyéramos de `sp` de nuevo cuando `eventos` termine
  // de cargar.
  const [resaltarInicial] = useState(() => sp.get("resaltar"));
  const [tipoInicial] = useState(() => sp.get("tipo"));
  const [radioKm, setRadioKm] = useState<RadioKm>(3);
  // `centro` = punto de referencia del mapa (movible).
  // `gps` = ubicación real del navegador, si la concedió.
  // `movido` = el usuario arrastró o recolocó el punto a mano.
  const [centro, setCentro] = useState(GRANADA_CALI);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [movido, setMovido] = useState(false);
  const movidoRef = useRef(false);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  // Perfil elegido por el buscador (mutuamente excluyente con `seleccionadoId`).
  const [perfilSeleccionado, setPerfilSeleccionado] =
    useState<ResultadoBusqueda | null>(null);
  // Se incrementa cada vez que el buscador elige un resultado: le indica al
  // mapa que vuele ahí aunque el punto no esté anclado a la ubicación real.
  const [volarId, setVolarId] = useState(0);
  // Evita repetir el flujo de ?resaltar= si el usuario ya interactuó.
  const resaltadoRef = useRef(false);

  const marcarMovido = useCallback((v: boolean) => {
    movidoRef.current = v;
    setMovido(v);
  }, []);

  // Ubicación del navegador; si se niega o falla, se queda en Granada.
  // Solo mueve el centro si el usuario aún no lo recolocó.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(coords);
        if (!movidoRef.current) setCentro(coords);
      },
      () => {}, // permiso negado: se queda en Granada
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // Recolocar el punto (arrastre del pin o pulsación larga en el mapa).
  const moverCentro = useCallback(
    (lat: number, lng: number) => {
      setCentro({ lat, lng });
      marcarMovido(true);
      setSeleccionadoId(null);
      setPerfilSeleccionado(null);
    },
    [marcarMovido],
  );

  const volverAMiUbicacion = useCallback(() => {
    if (!gps) return;
    setCentro(gps);
    marcarMovido(false);
    setSeleccionadoId(null);
    setPerfilSeleccionado(null);
  }, [gps, marcarMovido]);

  // Refleja los filtros en la URL (sin recargar) para que "Ver lista" y el
  // botón atrás del navegador los conserven.
  useEffect(() => {
    const qs = queryFiltros(filtro, precio);
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [filtro, precio]);

  // Trae de una vez los eventos futuros; el filtro se aplica en el cliente.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data, error: err } = await supabase
        .from("eventos_publicos")
        .select("*")
        .gte("starts_at", desde)
        .order("starts_at", { ascending: true });

      if (!vivo) return;
      if (err) setError(err.message);
      else setEventos((data as EventoPublico[]) ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Eventos que pasan el filtro de fecha + precio y caen dentro del radio.
  const visibles = useMemo(() => {
    const { desde, hasta } = rangoFiltro(filtro);
    return eventos.filter((ev) => {
      if (ev.latitude == null || ev.longitude == null) return false;
      if (!pasaPrecio(ev, precio)) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return dentroDeCaja(ev, centro, radioKm);
    });
  }, [eventos, filtro, precio, centro, radioKm]);

  const seleccionado =
    visibles.find((e) => e.id === seleccionadoId) ?? null;

  // Cambiar de filtro, precio o radio cierra la ficha abierta.
  function cambiarFiltro(f: Filtro) {
    setFiltro(f);
    setSeleccionadoId(null);
    setPerfilSeleccionado(null);
  }
  function cambiarPrecio(p: Precio) {
    setPrecio(p);
    setSeleccionadoId(null);
    setPerfilSeleccionado(null);
  }
  function cambiarRadio(km: RadioKm) {
    setRadioKm(km);
    setSeleccionadoId(null);
    setPerfilSeleccionado(null);
  }

  // Lo que elige el buscador: centra el mapa (y siempre vuela ahí, vía
  // `volarId`) y abre la ficha (de evento o de perfil, mutuamente
  // excluyentes; una "ubicacion" —el promedio de una ciudad— no tiene
  // ficha propia). Si el evento existe pero el filtro de fecha actual lo
  // escondería de la ficha, pasa a "Próximos" (sin tope) para garantizar
  // que se vea.
  function onSeleccionarResultado(resultado: ResultadoBusqueda) {
    if (resultado.latitude != null && resultado.longitude != null) {
      moverCentro(resultado.latitude, resultado.longitude);
      setVolarId((v) => v + 1);
    }
    if (resultado.tipo === "perfil" || resultado.tipo === "ubicacion") {
      setPerfilSeleccionado(resultado.tipo === "perfil" ? resultado : null);
      return;
    }
    setPerfilSeleccionado(null);
    const ev = eventos.find((e) => e.id === resultado.id);
    if (ev) {
      const { desde, hasta } = rangoFiltro(filtro);
      const t = new Date(ev.starts_at);
      if (t < desde || (hasta && t > hasta)) setFiltro("proximos");
    } else {
      setFiltro("proximos");
    }
    setSeleccionadoId(resultado.id);
  }

  // Si venimos de /lista con ?resaltar=&tipo= (el buscador de la lista solo
  // redirige acá), reproducir el mismo flujo. Perfil no depende de que
  // `eventos` haya cargado; evento sí, porque se busca en ese array.
  useEffect(() => {
    if (resaltadoRef.current) return;
    const resaltar = resaltarInicial;
    const tipo = tipoInicial;
    if (!resaltar) return;

    if (tipo === "perfil") {
      resaltadoRef.current = true;
      (async () => {
        const { data } = await supabase
          .from("perfiles")
          .select("id, tipo, slug, nombre, imagen_url, latitude, longitude")
          .eq("id", resaltar)
          .maybeSingle();
        if (data) {
          onSeleccionarResultado({
            tipo: "perfil",
            id: data.id,
            titulo: data.nombre,
            subtitulo: data.tipo,
            latitude: data.latitude,
            longitude: data.longitude,
            slug: data.slug,
            imagen_url: data.imagen_url,
            rank: 0,
          });
        }
      })();
      return;
    }

    if (tipo === "evento" && eventos.length > 0) {
      const ev = eventos.find((e) => e.id === resaltar);
      if (ev) {
        resaltadoRef.current = true;
        const resultado: ResultadoBusqueda = {
          tipo: "evento",
          id: ev.id,
          titulo: ev.title,
          subtitulo: ev.venue_name,
          latitude: ev.latitude,
          longitude: ev.longitude,
          slug: null,
          imagen_url: ev.flyer_url,
          rank: 0,
        };
        setTimeout(() => onSeleccionarResultado(resultado), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos]);

  // Tocar un pin cierra la tarjeta de lugar, si había una abierta.
  function seleccionarPin(id: string | null) {
    setSeleccionadoId(id);
    setPerfilSeleccionado(null);
  }

  return (
    <div className={styles.pantalla}>
      {/* El mapa a pantalla completa, detrás de todo. */}
      <div className={styles.lienzo}>
        <Mapa
          eventos={visibles}
          centro={centro}
          radioKm={radioKm}
          anclado={!movido}
          volarId={volarId}
          seleccionadoId={seleccionadoId}
          onSeleccionar={seleccionarPin}
          onMoverCentro={moverCentro}
        />
      </div>

      {/* Marca: directamente sobre el mapa, arriba a la izquierda. */}
      <div className={styles.marca}>
        En<i>Vivo</i>
      </div>

      {/* Buscador: junto a la marca. Colapsado es solo una lupa; al
          abrirse ocupa el resto de la fila, sin invadir la cuenta. */}
      <div className={styles.buscadorWrap}>
        <Buscador onSeleccionar={onSeleccionarResultado} />
      </div>

      {/* Mi cuenta (→ /yo): arriba a la derecha. */}
      <div className={styles.cuenta}>
        <EnlaceCuenta />
      </div>

      {/* Atajo a publicar: solo si la cuenta de Google ya tiene perfil. Ícono
          compacto (como EnlaceCuenta) para no chocar con el reel de filtros a
          360px de ancho; ver lib/cuentaPublicador.ts. */}
      {perfilPublicador && (
        <Link
          href="/publicar/nuevo"
          className={styles.publicarBtn}
          aria-label="Publicar evento"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      )}

      {/* Filtros de tiempo: cápsula de cristal bajo la marca. */}
      <div className={styles.reel}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={styles.filtro}
            aria-pressed={filtro === f.id}
            onClick={() => cambiarFiltro(f.id)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {/* Radio: vertical, centrado en el lado derecho. */}
      <div className={styles.radioCol}>
        <span className={styles.radioTitulo}>km</span>
        {RADIOS_KM.map((km) => (
          <button
            key={km}
            type="button"
            className={styles.km}
            aria-pressed={radioKm === km}
            onClick={() => cambiarRadio(km)}
          >
            {km}
          </button>
        ))}
      </div>

      {gps && movido && (
        <button
          type="button"
          className={styles.volverUbicacion}
          onClick={volverAMiUbicacion}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          Volver a mi ubicación
        </button>
      )}

      {error && (
        <p className={styles.aviso}>
          No se pudieron cargar los eventos: {error}
        </p>
      )}

      {/* Pie: barra de precio centrada; sube cuando aparece la tarjeta. */}
      <div className={styles.pie}>
        <div className={styles.precioBarra}>
          {PRECIOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.precio}
              aria-pressed={precio === p.id}
              onClick={() => cambiarPrecio(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        {(seleccionado || perfilSeleccionado) && (
          <div className={styles.ficha}>
            {perfilSeleccionado ? (
              <TarjetaLugar resultado={perfilSeleccionado} />
            ) : (
              <TarjetaEvento evento={seleccionado!} />
            )}
          </div>
        )}
      </div>

      {/* Atribución de Leaflet: obligatoria, discreta, esquina inferior derecha. */}
      <p className={styles.atribucion}>{TILES_ATRIBUCION}</p>

      <BarraInferior />
    </div>
  );
}
