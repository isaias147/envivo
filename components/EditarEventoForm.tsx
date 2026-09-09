"use client";

// Formulario de /mis-eventos/editar/[id] — Sesión 13, paso 6.
// Solo tres cosas: flyer, video y ubicación. Se guarda directo (sin
// re-revisión). El resto del evento no se toca acá.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import styles from "./EditarEventoForm.module.css";

const MapaSelector = dynamic(() => import("@/components/MapaSelector"), {
  ssr: false,
  loading: () => <div className={styles.mapaCargando}>Cargando mapa…</div>,
});

const MIMES_OK = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

type Evento = {
  id: string;
  title: string;
  cover_url: string | null;
  post_url: string | null;
  latitude: number | null;
  longitude: number | null;
  series_id: string | null;
};

export default function EditarEventoForm({ evento }: { evento: Evento }) {
  const router = useRouter();

  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerPrev, setFlyerPrev] = useState<string | null>(evento.cover_url);
  const [video, setVideo] = useState(evento.post_url ?? "");
  const [punto, setPunto] = useState({
    lat: evento.latitude ?? 3.4516,
    lng: evento.longitude ?? -76.532,
  });
  const [movido, setMovido] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ reubicado: boolean } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

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
    if (flyerPrev && flyerPrev.startsWith("blob:")) URL.revokeObjectURL(flyerPrev);
    setFlyerFile(f);
    setFlyerPrev(URL.createObjectURL(f));
  }

  async function guardar() {
    if (guardando) return;
    setError(null);
    setGuardando(true);
    try {
      // 1. Flyer nuevo (si lo hay) → bucket `flyers`, igual que al publicar.
      let coverUrl: string | undefined;
      if (flyerFile) {
        const ext = (flyerFile.name.split(".").pop() || "jpg").toLowerCase();
        const ruta = `publico/${crypto.randomUUID()}.${ext}`;
        const { error: errSubida } = await supabase.storage
          .from("flyers")
          .upload(ruta, flyerFile, {
            contentType: flyerFile.type,
            upsert: false,
          });
        if (errSubida) {
          setError("No se pudo subir el flyer. Intentá de nuevo.");
          setGuardando(false);
          return;
        }
        coverUrl = supabase.storage.from("flyers").getPublicUrl(ruta).data
          .publicUrl;
      }

      // 2. Guardar por la API route (verifica que el evento sea tuyo).
      const r = await fetch("/api/publicador/evento/editar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: evento.id,
          coverUrl,
          postUrl: video,
          latitude: punto.lat,
          longitude: punto.lng,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo guardar.");
        setGuardando(false);
        return;
      }
      setHecho({ reubicado: Boolean(j.reubicado) });
      router.refresh();
    } catch {
      setError("Falló la conexión. Intentá de nuevo.");
      setGuardando(false);
    }
  }

  if (hecho) {
    return (
      <div className={styles.hecho}>
        <p className={styles.hechoTit}>Cambios guardados</p>
        {hecho.reubicado && (
          <p className={styles.reubi}>
            Moviste el punto más de 500 m del lugar original. Queda anotado.
          </p>
        )}
        <Link href="/mis-eventos" className={styles.volver}>
          Volver a mis eventos
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      {/* flyer */}
      <div className={styles.campo}>
        <label>Flyer</label>
        <div className={styles.flyerFila}>
          <div className={styles.flyerPrev}>
            {flyerPrev ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flyerPrev} alt="Flyer del evento" />
            ) : (
              <span>Sin flyer</span>
            )}
          </div>
          <button
            type="button"
            className={styles.secundario}
            onClick={() => fileRef.current?.click()}
          >
            Cambiar flyer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => elegirFlyer(e.target.files?.[0] ?? null)}
          />
        </div>
        <p className={styles.ayuda}>JPG, PNG o WebP · máximo 3 MB.</p>
      </div>

      {/* video */}
      <div className={styles.campo}>
        <label htmlFor="video">Link del video (reel o TikTok)</label>
        <input
          id="video"
          value={video}
          onChange={(e) => {
            setVideo(e.target.value);
            setError(null);
          }}
          placeholder="instagram.com/reel/…"
        />
        <p className={styles.ayuda}>Opcional. Déjalo vacío para quitarlo.</p>
      </div>

      {/* ubicación */}
      <div className={styles.campo}>
        <label>Ubicación</label>
        <div className={styles.mapita}>
          <MapaSelector
            punto={punto}
            movido={movido}
            onCambio={(lat, lng) => {
              setPunto({ lat, lng });
              setMovido(true);
            }}
          />
          <div className={styles.pista}>
            {movido
              ? "Arrastra el pin para ajustarlo"
              : "Arrastra el pin si el lugar cambió"}
          </div>
        </div>
        <p className={styles.ayuda}>
          Si lo mueves más de 500 m del sitio original, lo revisamos.
        </p>
      </div>

      <button
        type="button"
        className={styles.guardar}
        onClick={guardar}
        disabled={guardando}
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
      <Link href="/mis-eventos" className={styles.cancelar}>
        Cancelar
      </Link>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
