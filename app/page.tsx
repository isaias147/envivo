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
  pasaFiltroEdad,
  pasaPrecio,
  queryFiltros,
  rangoFiltro,
  type EventoPublico,
  type Filtro,
  type FiltroEdad as FiltroEdadValor,
  type Precio,
} from "@/lib/eventos";
import TarjetaEvento from "@/components/TarjetaEvento";
import TarjetaLugar from "@/components/TarjetaLugar";
import Buscador from "@/components/Buscador";
import BarraFlotante from "@/components/BarraFlotante";
import EnlaceCuenta from "@/components/EnlaceCuenta";
import FiltroEdad from "@/components/FiltroEdad";
import { TILES_ATRIBUCION } from "@/lib/mapaTiles";
import type { ResultadoBusqueda } from "@/lib/busqueda";
import styles from "./page.module.css";

// El mapa se carga solo en el navegador (Leaflet necesita `window`).
const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "proximos", etiqueta: "Próximamente" },
  { id: "hoy", etiqueta: "Esta noche" },
  { id: "finde", etiqueta: "Este finde" },
];

// Etiquetas del filtro de precio (el tipo y la lógica viven en lib/eventos).
const PRECIOS: { id: Precio; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "gratis", etiqueta: "Gratis" },
  { id: "cover", etiqueta: "Cover" },
];

// Radio del mapa: fijo, ya no hay selector de km.
const RADIO_FIJO_KM = 7;

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
  // Filtros iniciales desde la URL (?t=&p=), para conservarlos al venir
  // de /lista. El radio es propio del mapa y no se comparte.
  const [filtro, setFiltro] = useState<Filtro>(() => leerFiltro(sp.get("t")));
  const [precio, setPrecio] = useState<Precio>(() => leerPrecio(sp.get("p")));
  const [edad, setEdad] = useState<FiltroEdadValor>(() => leerEdad(sp.get("ed")));
  // El desplegable de Edad abre hacia abajo: mientras está abierto, sube
  // toda la fila de filtros para que el menú no quede tapado por lo que
  // hay debajo (BarraFlotante, barra de atribución, etc.).
  const [edadMenuAbierto, setEdadMenuAbierto] = useState(false);
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
  // Alto real de la ficha abierta (evento o perfil): sube la columna de
  // FABs exactamente esa medida, en vez de que la tarjeta se achique para
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

  const volverAMiUbicacion = useCallback(() => {
    if (!gps) return;
    setCentro(gps);
    marcarMovido(false);
    setSeleccionadoId(null);
    setPerfilSeleccionado(null);
  }, [gps, marcarMovido]);

  // Refleja los filtros y el centro en la URL (sin recargar) para que "Ver
  // lista" y el botón atrás del navegador los conserven — así /lista
  // arranca del mismo punto en vez de saltar a Granada.
  useEffect(() => {
    const qs = queryFiltros(filtro, precio, edad, undefined, centro);
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [filtro, precio, edad, centro]);

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
      if (!pasaFiltroEdad(ev, edad)) return false;
      const t = new Date(ev.starts_at);
      if (t < desde) return false;
      if (hasta && t > hasta) return false;
      return dentroDeCaja(ev, centro, RADIO_FIJO_KM);
    });
  }, [eventos, filtro, precio, edad, centro]);

  const seleccionado =
    visibles.find((e) => e.id === seleccionadoId) ?? null;

  // Mide el alto real de la ficha mientras está abierta (evento o perfil);
  // se lo pasamos a BarraFlotante para que suba los FABs esa medida exacta.
  const fichaAbierta = Boolean(seleccionado || perfilSeleccionado);
  useEffect(() => {
    if (!fichaAbierta) {
      setAlturaFicha(0);
      return;
    }
    const el = fichaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setAlturaFicha(entries[0]?.contentRect.height ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fichaAbierta]);

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
  function cambiarEdad(e: FiltroEdadValor) {
    setEdad(e);
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
          centro={centro}
          radioKm={RADIO_FIJO_KM}
          anclado={!movido}
          volarId={volarId}
          seleccionadoId={seleccionadoId}
          onSeleccionar={seleccionarPin}
          onMoverCentro={moverCentro}
        />
      </div>

      {/* Marca: directamente sobre el mapa, arriba a la izquierda. Se
          desvanece mientras el desplegable de Edad está abierto (sube
          hasta su altura, ver grupoFiltrosSubido). */}
      <div
        className={`${styles.marca} ${edadMenuAbierto ? styles.marcaOculta : ""}`}
      >
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

      {error && (
        <p className={styles.aviso}>
          No se pudieron cargar los eventos: {error}
        </p>
      )}

      {/* Pie: barra de tiempo + barra de precio, apiladas y centradas;
          sube cuando aparece la tarjeta. */}
      <div className={styles.pie}>
        <div
          className={`${styles.grupoFiltros} ${edadMenuAbierto ? styles.grupoFiltrosSubido : ""}`}
        >
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
          <div className={styles.filaFiltros}>
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
            <FiltroEdad
              valor={edad}
              onCambiar={cambiarEdad}
              onAbiertoCambio={setEdadMenuAbierto}
            />
          </div>
        </div>
        {(seleccionado || perfilSeleccionado) && (
          <div className={styles.ficha} ref={fichaRef}>
            {perfilSeleccionado ? (
              <TarjetaLugar resultado={perfilSeleccionado} />
            ) : (
              <TarjetaEvento
                evento={seleccionado!}
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

      <BarraFlotante
        ubicacionMapa={{
          disponible: Boolean(gps && movido),
          onClick: volverAMiUbicacion,
        }}
        alturaExtra={alturaFicha}
      />
    </div>
  );
}
