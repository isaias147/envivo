"use client";

// Formulario de /perfil — Sesión 13, paso 7. Sigue la pantalla 8
// ("Editar perfil — /perfil") de envivo-grupo2-publicador.html.
//
// - Nombre: libre.
// - Instagram y WhatsApp público: con candado de 30 días. Cuando está
//   bloqueado se muestran en modo lectura + la fecha de desbloqueo. El
//   servidor revalida el candado al guardar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  PAISES_WHATSAPP,
  partirWhatsapp,
  sinArroba,
} from "@/lib/eventos";
import styles from "./EditarPerfilForm.module.css";

type Props = {
  nombre: string;
  instagram: string;
  whatsappPublico: string; // indicativo + dígitos, o ""
  tipoEtiqueta: string | null;
  bloqueado: boolean;
  desbloqueaEn: string | null; // ISO
};

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default function EditarPerfilForm({
  nombre: nombreInicial,
  instagram: igInicial,
  whatsappPublico,
  tipoEtiqueta,
  bloqueado: bloqueadoInicial,
  desbloqueaEn: desbloqueaInicial,
}: Props) {
  const router = useRouter();
  const waPartido = partirWhatsapp(whatsappPublico);

  const [nombre, setNombre] = useState(nombreInicial);
  const [instagram, setInstagram] = useState(igInicial ? `@${igInicial}` : "");
  const [indicativo, setIndicativo] = useState(waPartido.indicativo);
  const [waNacional, setWaNacional] = useState(waPartido.nacional);

  const [bloqueado, setBloqueado] = useState(bloqueadoInicial);
  const [desbloqueaEn, setDesbloqueaEn] = useState(desbloqueaInicial);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    if (guardando) return;
    setError(null);
    setAviso(null);
    setGuardando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const r = await fetch("/api/publicador/perfil/editar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          nombre,
          instagram,
          indicativoPublico: indicativo,
          whatsappPublico: waNacional,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo guardar.");
        if (j.desbloqueaEn) {
          setBloqueado(true);
          setDesbloqueaEn(j.desbloqueaEn);
        }
        setGuardando(false);
        return;
      }
      setBloqueado(Boolean(j.bloqueado));
      setDesbloqueaEn(j.desbloqueaEn ?? null);
      setAviso(
        j.redesCambiaron
          ? "Guardado. Instagram y WhatsApp quedan bloqueados 30 días."
          : "Guardado.",
      );
      router.refresh();
    } catch {
      setError("Falló la conexión. Intenta de nuevo.");
    }
    setGuardando(false);
  }

  const candadoTexto =
    bloqueado && desbloqueaEn
      ? `🔒 Puedes cambiarlo desde el ${fechaLarga(desbloqueaEn)}`
      : null;

  const igPreview = sinArroba(instagram);

  return (
    <div className={styles.form}>
      <div className={styles.campo}>
        <label htmlFor="p-nombre">Nombre</label>
        <input
          id="p-nombre"
          value={nombre}
          maxLength={80}
          onChange={(e) => {
            setNombre(e.target.value);
            setError(null);
          }}
        />
      </div>

      <div className={`${styles.campo} ${bloqueado ? styles.bloqueado : ""}`}>
        <label htmlFor="p-ig">Instagram</label>
        <input
          id="p-ig"
          value={instagram}
          disabled={bloqueado}
          placeholder="@tucuenta"
          onChange={(e) => {
            setInstagram(e.target.value);
            setError(null);
          }}
        />
        {candadoTexto && <div className={styles.candado}>{candadoTexto}</div>}
      </div>

      <div className={`${styles.campo} ${bloqueado ? styles.bloqueado : ""}`}>
        <label htmlFor="p-wa">WhatsApp público</label>
        <div className={styles.telFila}>
          <select
            aria-label="Indicativo de país"
            value={indicativo}
            disabled={bloqueado}
            onChange={(e) => setIndicativo(e.target.value)}
          >
            {PAISES_WHATSAPP.map((p) => (
              <option key={p.nombre} value={p.indicativo}>
                +{p.indicativo} · {p.nombre}
              </option>
            ))}
          </select>
          <input
            id="p-wa"
            type="tel"
            inputMode="numeric"
            value={waNacional}
            disabled={bloqueado}
            placeholder="300 291 7326"
            onChange={(e) => {
              setWaNacional(e.target.value);
              setError(null);
            }}
          />
        </div>
        {candadoTexto && <div className={styles.candado}>{candadoTexto}</div>}
      </div>

      <div className={styles.vistaPrevia}>
        <div className={styles.etiqueta}>Así te ven</div>
        <b className={styles.pvNombre}>{nombre || "Tu perfil"}</b>
        <div className={styles.pvMeta}>
          {[tipoEtiqueta, igPreview ? `@${igPreview}` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      <button
        type="button"
        className={styles.guardar}
        onClick={guardar}
        disabled={guardando}
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>

      {aviso && <p className={styles.aviso}>{aviso}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
