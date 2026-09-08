"use client";

// Pantalla 6 · /registro/verificar — mostrar el código y esperar el mensaje.
// El código sale de la cookie `envivo_registro` vía /api/registro/estado.
// "Enviar por WhatsApp" abre wa.me con el mensaje ya escrito al número de
// EnVivo. Cada 5 s consultamos si el equipo (o el webhook) ya lo confirmó;
// cuando sí, seguimos a /registro/perfil.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../registro.module.css";

const NUM_ENVIVO = (process.env.NEXT_PUBLIC_ENVIVO_WHATSAPP ?? "").replace(
  /\D/g,
  "",
);

export default function Verificar() {
  const router = useRouter();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [reenviando, setReenviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yaSalte = useRef(false);

  const consultar = useCallback(async () => {
    try {
      const r = await fetch("/api/registro/estado", { cache: "no-store" });
      const j = await r.json();
      if (j.sinRegistro) {
        router.replace("/registro");
        return;
      }
      if (j.codigo) setCodigo(String(j.codigo));
      if (j.verificado && !yaSalte.current) {
        yaSalte.current = true;
        router.replace("/registro/perfil");
      }
    } catch {
      // reintenta en el siguiente tick
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      await consultar();
    })();
    const t = setInterval(consultar, 5000);
    return () => clearInterval(t);
  }, [consultar]);

  async function otroCodigo() {
    if (reenviando) return;
    setError(null);
    setReenviando(true);
    try {
      const r = await fetch("/api/registro/reenviar", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo generar otro código.");
      } else {
        setCodigo(String(j.codigo));
      }
    } catch {
      setError("Falló la conexión. Intentá de nuevo.");
    }
    setReenviando(false);
  }

  const digitos = (codigo ?? "····").split("");
  const mensajeWa = `EnVivo ${codigo ?? ""}`.trim();
  const enlaceWa = NUM_ENVIVO
    ? `https://wa.me/${NUM_ENVIVO}?text=${encodeURIComponent(mensajeWa)}`
    : null;

  return (
    <div className={styles.pantalla}>
      <div className={styles.marco}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <div className={styles.ruta}>envivo.app/registro/verificar</div>

        <h1 className={styles.tit}>Confirmá que sos vos</h1>
        <p className={styles.bajada}>
          Enviá este código por WhatsApp al número de EnVivo. Es gratis y
          prueba que el número es tuyo.
        </p>

        <div className={styles.codigoCaja}>
          {digitos.map((d, i) => (
            <div
              key={i}
              className={`${styles.digito} ${
                d !== "·" ? styles.lleno : ""
              }`}
            >
              {d === "·" ? "" : d}
            </div>
          ))}
        </div>

        {enlaceWa ? (
          <a
            className={styles.waBtn}
            href={enlaceWa}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar por WhatsApp
          </a>
        ) : (
          <p className={styles.error}>
            Falta configurar el número de WhatsApp de EnVivo
            (NEXT_PUBLIC_ENVIVO_WHATSAPP).
          </p>
        )}

        <div className={styles.espera}>
          {cargando ? "Cargando…" : "Esperando tu mensaje…"}
        </div>

        <button
          type="button"
          className={styles.reintento}
          onClick={otroCodigo}
          disabled={reenviando}
        >
          {reenviando ? "Generando…" : "¿No llegó? Generar otro código"}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
