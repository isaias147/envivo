"use client";

// Pantalla 5 · /registro — alta del publicador en dos pasos.
// 5a: elegir tipo (Local / Organizador / Artista).
// 5b: nombre + WhatsApp de cuenta.
// Al enviar el paso 2, POST /api/registro/iniciar genera el código y deja la
// cookie provisional; seguimos a /registro/verificar.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAISES_WHATSAPP,
  PAIS_WHATSAPP_POR_DEFECTO,
} from "@/lib/eventos";
import { TIPOS_PERFIL } from "@/lib/registroPublicador";
import type { TipoPerfil } from "@/lib/sesionPublicador";
import styles from "./registro.module.css";

export default function Registro() {
  const router = useRouter();
  const [revisando, setRevisando] = useState(true);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [nombre, setNombre] = useState("");
  const [indicativo, setIndicativo] = useState(PAIS_WHATSAPP_POR_DEFECTO);
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión de publicador, directo al panel.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/registro/sesion", { cache: "no-store" });
        const j = await r.json();
        if (vivo && j.activa) {
          router.replace("/panel");
          return;
        }
      } catch {
        // sin conexión: mostramos el formulario igual
      }
      if (vivo) setRevisando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  const infoTipo = TIPOS_PERFIL.find((t) => t.valor === tipo);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !tipo) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/registro/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, nombre, indicativo, whatsapp }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo enviar el código.");
        setEnviando(false);
        return;
      }
      router.push("/registro/verificar");
    } catch {
      setError("Falló la conexión. Intentá de nuevo.");
      setEnviando(false);
    }
  }

  if (revisando) {
    return (
      <div className={styles.pantalla}>
        <p className={styles.cargandoPantalla}>Cargando…</p>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/registro</div>

        {paso === 1 && (
          <>
            <h1 className={styles.tit}>¿Cómo publicás?</h1>
            <p className={styles.bajada}>
              Elegí el que mejor te describe. Podés cambiarlo después.
            </p>

            {TIPOS_PERFIL.map((t) => (
              <button
                key={t.valor}
                type="button"
                className={`${styles.tarjetaTipo} ${
                  tipo === t.valor ? styles.activa : ""
                }`}
                onClick={() => setTipo(t.valor)}
              >
                <span className={styles.ico}>{t.icono}</span>
                <span>
                  <b>{t.titulo}</b>
                  <small>{t.detalle}</small>
                </span>
              </button>
            ))}

            <button
              type="button"
              className={styles.principal}
              style={{ marginTop: 16 }}
              disabled={!tipo}
              onClick={() => setPaso(2)}
            >
              Continuar
            </button>
          </>
        )}

        {paso === 2 && (
          <form onSubmit={enviar}>
            <h1 className={styles.tit}>Tus datos</h1>
            <p className={styles.bajada}>
              Este WhatsApp es tu acceso a EnVivo. No se muestra en público
              hasta que vos lo decidas.
            </p>

            <div className={styles.campo}>
              <label htmlFor="nombre">
                {infoTipo?.etiquetaNombre ?? "Nombre"}
              </label>
              <input
                id="nombre"
                value={nombre}
                maxLength={80}
                autoComplete="organization"
                onChange={(e) => {
                  setNombre(e.target.value);
                  setError(null);
                }}
              />
            </div>

            <div className={styles.campo}>
              <label htmlFor="wa">WhatsApp de tu cuenta</label>
              <div className={styles.telFila}>
                <select
                  aria-label="Indicativo de país"
                  value={indicativo}
                  onChange={(e) => setIndicativo(e.target.value)}
                >
                  {PAISES_WHATSAPP.map((p) => (
                    <option key={p.nombre} value={p.indicativo}>
                      +{p.indicativo} · {p.nombre}
                    </option>
                  ))}
                </select>
                <input
                  id="wa"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="300 291 7326"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.principal}
              style={{ marginTop: 8 }}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : "Enviarme el código por SMS"}
            </button>

            <button
              type="button"
              className={styles.reintento}
              style={{ marginTop: 12 }}
              onClick={() => {
                setPaso(1);
                setError(null);
              }}
            >
              ← Cambiar el tipo
            </button>

            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
