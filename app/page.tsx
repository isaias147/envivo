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
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  dentroDeCaja,
  distanciaMetros,
  GRANADA_CALI,
  leerCentro,
  leerEdad,
  leerFiltro,
  leerPrecio,
  leerTipos,
  pasaFiltroEdad,
  pasaPrecio,
  pasaTipos,
  leerFechas,
  leerRadio,
  queryFiltros,
  contarFiltrosActivos,
  escribirFecha,
  rangoFiltro,
  type EventoPublico,
  type Fechas,
  type Filtro,
  type FiltroEdad as FiltroEdadValor,
  type Precio,
  type RadioKm,
} from "@/lib/eventos";
import TarjetaEvento from "@/components/TarjetaEvento";
import TarjetaLugar from "@/components/TarjetaLugar";
import Buscador from "@/components/Buscador";
import SelectorRadio from "@/components/SelectorRadio";
import BotonUbicacion from "@/components/BotonUbicacion";
import Logo from "@/components/Logo";
import Filtros, { type EstadoFiltros } from "@/components/Filtros";
import FiltroTipos from "@/components/FiltroTipos";
import { TILES_ATRIBUCION } from "@/lib/mapaTiles";
import type { ResultadoBusqueda } from "@/lib/busqueda";
import styles from "./page.module.css";

// El mapa se carga solo en el navegador (Leaflet necesita `window`).
const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

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
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Filtros iniciales desde la URL (?t=&p=&km=…), para conservarlos al
  // venir de /lista. El radio (?km=) es el mismo en las dos pantallas.
  const [filtro, setFiltro] = useState<Filtro>(() => leerFiltro(sp.get("t")));
  const [precio, setPrecio] = useState<Precio>(() => leerPrecio(sp.get("p")));
  const [edad, setEdad] = useState<FiltroEdadValor>(() => leerEdad(sp.get("ed")));
  // Rango de "Fechas" (hoja de filtros): ?fd=&fh=, solo si t=fechas.
  const [fechas, setFechas] = useState<Fechas>(() => leerFechas(sp));
  // Chips de categoría (Música en vivo, Cultural, ...), selección múltiple;
  // [] = todas. Filtro independiente de Todo/Gratis/Cover y de Edad.
  const [tipos, setTipos] = useState<string[]>(() => leerTipos(sp.get("tipos")));
  const [radioKm, setRadioKm] = useState<RadioKm>(() => leerRadio(sp.get("km")));
  // ?resaltar=&tipo=, leídos UNA sola vez al montar: el efecto que sincroniza
  // ?t=&p= en la URL (más abajo) reemplaza el historial apenas se monta y
  // los borraría si los leyéramos de `sp` de nuevo cuando `eventos` termine
  // de cargar.
  const [resaltarInicial] = useState(() => sp.get("resaltar"));
  const [tipoInicial] = useState(() => sp.get("tipo"));
  // `centro` = punto de referencia del mapa (movible).
  // `gps` = ubicación real del navegador, si la concedió.
  // `movido` = el usuario arrastró o recolocó el punto a mano.
  // Si venimos de /lista con ?lat=&lng=, arrancamos ahí (leído una sola vez,
  // igual que resaltarInicial/tipoInicial) en vez de en Granada, y esa
  // posición ya cuenta como "movida" — no es GPS, así que el efecto de
  // geolocalización de abajo no debe pisarla.
  const [centroInicial] = useState(() => leerCentro(sp));
  const [centro, setCentro] = useState(() => centroInicial ?? GRANADA_CALI);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [movido, setMovido] = useState(() => centroInicial != null);
  const movidoRef = useRef(centroInicial != null);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  // Perfil elegido por el buscador (mutuamente excluyente con `seleccionadoId`).
  const [perfilSeleccionado, setPerfilSeleccionado] =
    useState<ResultadoBusqueda | null>(null);
  // Se incrementa cada vez que el buscador elige un resultado: le indica al
  // mapa que vuele ahí aunque el punto no esté anclado a la ubicación real.
  const [volarId, setVolarId] = useState(0);
  // Evita repetir el flujo de ?resaltar= si el usuario ya interactuó.
  const resaltadoRef = useRef(false);
  // Alto real de la ficha abierta (evento o perfil): sube el botón de
  // ubicación exactamente esa medida, en vez de que la tarjeta se achique para
  // no chocar con ellos. 0 cuando no hay ficha.
  const fichaRef = useRef<HTMLDivElement>(null);
  const [alturaFicha, setAlturaFicha] = useState(0);

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

  // "Volver a mi ubicación" (BotonUbicacion): trae una lectura fresca del
  // GPS, pone ahí el punto y fuerza a la cámara a volar (volarId), aunque el
  // punto ya estuviera ahí y el usuario solo haya paneado el mapa.
  const irAMiUbicacion = useCallback(
    (coords: { lat: number; lng: number }) => {
      setGps(coords);
      setCentro(coords);
      marcarMovido(false);
      setVolarId((n) => n + 1);
      setSeleccionadoId(null);
      setPerfilSeleccionado(null);
    },
    [marcarMovido],
  );
  // El punto "está en tu ubicación" si queda a menos de 50 m del GPS (la
  // URL redondea a 4 decimales, ~11 m, y el GPS varía entre lecturas).
  const enMiUbicacion =
    gps != null && distanciaMetros(centro, gps) < 50;

  // Refleja los filtros y el centro en la URL (sin recargar) para que "Ver
  // lista" y el botón atrás del navegador los conserven — así /lista
  // arranca del mismo punto en vez de saltar a Granada.
  useEffect(() => {
    const qs = queryFiltros(filtro, precio, edad, radioKm, centro, tipos, fechas);
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [filtro, precio, edad, radioKm, centro, tipos, fechas]);

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
    const { desde, hasta } = rangoFiltro(filtro, new Date(), fechas);
    return eventos.filter((ev) => {
      if (ev.latitude == null || ev.longitude == null) return false;
      if (!pasaPrecio(ev, precio)) return false;
      if (!pasaFiltroEdad(ev, edad)) return false;
      if (!pasaTipos(ev, tipos)) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return dentroDeCaja(ev, centro, radioKm);
    });
  }, [eventos, filtro, fechas, precio, edad, tipos, centro, radioKm]);

  // ¿Hay algún filtro de contenido puesto (tiempo/precio/edad/categorías),
  // aparte del radio de búsqueda? Con eso el mapa decide si debe
  // encuadrar los pines resultantes o volver a la vista original (ver
  // EncuadreFiltro en components/Mapa.tsx). `filtroFirma` es la señal que
  // dispara ese encuadre — cambia solo cuando cambia el contenido del
  // filtro, nunca por un simple paneo o arrastre del pin.
  const estadoFiltros: EstadoFiltros = { filtro, fechas, precio, edad, tipos };
  const hayFiltroActivo = contarFiltrosActivos(estadoFiltros) > 0;
  const filtroFirma = [
    filtro,
    fechas.desde ? escribirFecha(fechas.desde) : "",
    fechas.hasta ? escribirFecha(fechas.hasta) : "",
    precio,
    edad,
    [...tipos].sort().join(","),
  ].join("|");

  const seleccionado =
    visibles.find((e) => e.id === seleccionadoId) ?? null;

  // Mide el alto real de la ficha mientras está abierta (evento o perfil);
  // se lo pasamos a BotonUbicacion para que suba esa medida exacta.
  const fichaAbierta = Boolean(seleccionado || perfilSeleccionado);
  useEffect(() => {
    if (!fichaAbierta) return;
    const el = fichaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setAlturaFicha(entries[0]?.contentRect.height ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fichaAbierta]);
  // Sin ficha la altura es 0: se deriva acá en vez de guardarla en el
  // efecto (un setState síncrono dentro del efecto dispara renders de más).
  const alturaVisible = fichaAbierta ? alturaFicha : 0;

  // Cambiar de filtro, precio o radio cierra la ficha abierta.
  // Hoja de filtros (y chips de arriba): aplica al instante.
  function cambiarFiltros(c: Partial<EstadoFiltros>) {
    if (c.filtro !== undefined) setFiltro(c.filtro);
    if (c.fechas !== undefined) setFechas(c.fechas);
    if (c.precio !== undefined) setPrecio(c.precio);
    if (c.edad !== undefined) setEdad(c.edad);
    if (c.tipos !== undefined) setTipos(c.tipos);
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
      const { desde, hasta } = rangoFiltro(filtro, new Date(), fechas);
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

  // Tocar un pin lo abre o, si ya estaba abierto, lo cierra (toggle); en
  // cualquier caso cierra la tarjeta de lugar, si había una abierta.
  function seleccionarPin(id: string | null) {
    setSeleccionadoId((actual) => (actual === id ? null : id));
    setPerfilSeleccionado(null);
  }

  return (
    <div className={styles.pantalla}>
      {/* El mapa a pantalla completa, detrás de todo. */}
      <div className={styles.lienzo}>
        <Mapa
          eventos={visibles}
          totalCargado={eventos.length}
          centro={centro}
          radioKm={radioKm}
          anclado={!movido}
          volarId={volarId}
          seleccionadoId={seleccionadoId}
          onSeleccionar={seleccionarPin}
          onMoverCentro={moverCentro}
          hayFiltroActivo={hayFiltroActivo}
          filtroFirma={filtroFirma}
        />
      </div>

      {/* Marca: sobre el mapa, abajo a la izquierda (a la altura del botón
          de ubicación). */}
      <div className={styles.marca}>
        <Logo />
      </div>

      {/* Buscador + botón de filtros (abre la hoja con todos los filtros). */}
      <div className={styles.buscadorWrap}>
        <div className={styles.buscador}>
          <Buscador onSeleccionar={onSeleccionarResultado} />
        </div>
        <Filtros valor={estadoFiltros} onCambiar={cambiarFiltros} total={visibles.length} />
      </div>

      {/* Chips de categoría, debajo de la barra de búsqueda. Filtro aparte
          de Todo/Gratis/Cover, Edad y tiempo: selección múltiple, ninguno
          activo = todas. */}
      <div className={styles.tipos}>
        <FiltroTipos valor={tipos} onCambiar={(t) => cambiarFiltros({ tipos: t })} />
      </div>

      {/* Radio de búsqueda: debajo de los chips, a la derecha. */}
      <div className={styles.radio}>
        <SelectorRadio radioKm={radioKm} onCambiar={cambiarRadio} />
      </div>

      {error && (
        <p className={styles.aviso}>
          No se pudieron cargar los eventos: {error}
        </p>
      )}

      {/* Pie: la ficha del evento o lugar elegido. */}
      <div className={styles.pie}>
        {(seleccionado || perfilSeleccionado) && (
          <div className={styles.ficha} ref={fichaRef}>
            {perfilSeleccionado ? (
              <TarjetaLugar resultado={perfilSeleccionado} />
            ) : (
              <TarjetaEvento
                evento={seleccionado!}
                mostrarFecha
                distanciaKm={
                  seleccionado!.latitude != null && seleccionado!.longitude != null
                    ? distanciaMetros(centro, {
                        lat: seleccionado!.latitude,
                        lng: seleccionado!.longitude,
                      }) / 1000
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Atribución de Leaflet: obligatoria, discreta, esquina inferior derecha. */}
      <p className={styles.atribucion}>{TILES_ATRIBUCION}</p>

      <BotonUbicacion
        activo={enMiUbicacion}
        onUbicacion={irAMiUbicacion}
        alturaExtra={alturaVisible}
      />

    </div>
  );
}
