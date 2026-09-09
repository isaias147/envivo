"use client";

// Pantalla 6 · /registro/verificar — escribir el código que llegó por SMS.
// Twilio Verify mandó el SMS al número que se puso en /registro. Acá el
// usuario escribe los 4 dígitos; al enviar, POST /api/registro/verificar se
// los pasa a Twilio y, si están bien, seguimos a /registro/perfil.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearWhatsapp } from "@/lib/eventos";
import styles from "../registro.module.css";

const LARGO = 4;

export default function Verificar() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [valores, setValores] = useState<string[]>(Array(LARGO).fill(""));
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const casillas = useRef<(HTMLInputElement | null)[]>([]);
  const yaSalte = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/registro/estado", { cache: "no-store" });
        const j = await r.json();
        if (!vivo) return;
        if (j.sinRegistro) {
          router.replace("/registro");
          return;
        }
        if (j.verificado) {
          router.replace("/registro/perfil");
          return;
        }
        setWhatsapp(j.whatsapp ?? "");
      } catch {
        // sin conexión: mostramos las casillas igual
      }
      if (vivo) {
        setCargando(false);
        casillas.current[0]?.focus();
      }
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  const enviar = useCallback(
    async (codigo: string) => {
      if (enviando || yaSalte.current) return;
      setError(null);
      setEnviando(true);
      try {
        const r = await fetch("/api/registro/verificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo }),
        });
        const j = await r.json();
        if (!r.ok) {
          setError(j.error ?? "No se pudo verificar el código.");
          setValores(Array(LARGO).fill(""));
          casillas.current[0]?.focus();
          setEnviando(false);
          return;
        }
        yaSalte.current = true;
        router.replace("/registro/perfil");
      } catch {
        setError("Falló la conexión. Intentá de nuevo.");
        setEnviando(false);
      }
    },
    [enviando, router],
  );

  function escribir(i: number, bruto: string) {
    const digitos = bruto.replace(/\D/g, "");
    if (!digitos) return;
    setError(null);
    setValores((prev) => {
      const sig = [...prev];
      // Un dígito por casilla; si pegaron varios, se reparten desde aquí.
      for (let k = 0; k < digitos.length && i + k < LARGO; k++) {
        sig[i + k] = digitos[k];
      }
      const lleno = sig.every((d) => d !== "");
      const foco = Math.min(i + digitos.length, LARGO - 1);
      casillas.current[foco]?.focus();
      if (lleno) void enviar(sig.join(""));
      return sig;
    });
  }

  function teclear(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !valores[i] && i > 0) {
      casillas.current[i - 1]?.focus();
      setValores((prev) => {
        const sig = [...prev];
        sig[i - 1] = "";
        return sig;
      });
    }
  }

  async function reenviar() {
    if (reenviando) return;
    setError(null);
    setAviso(null);
    setReenviando(true);
    try {
      const r = await fetch("/api/registro/reenviar", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo reenviar el SMS.");
      } else {
        setAviso("Te mandamos otro SMS.");
        setValores(Array(LARGO).fill(""));
        casillas.current[0]?.focus();
      }
    } catch {
      setError("Falló la conexión. Intentá de nuevo.");
    }
    setReenviando(false);
  }

  if (cargando) {
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
        <div className={styles.ruta}>envivo.app/registro/verificar</div>

        <h1 className={styles.tit}>Escribí el código</h1>
        <p className={styles.bajada}>
          Te mandamos un SMS con un código de {LARGO} dígitos
          {whatsapp ? ` al ${formatearWhatsapp(whatsapp)}` : ""}. Escribilo acá.
        </p>

        <div className={styles.codigoInputs}>
          {valores.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                casillas.current[i] = el;
              }}
              className={`${styles.digitoInput} ${d ? styles.lleno : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={LARGO}
              value={d}
              disabled={enviando}
              onChange={(e) => escribir(i, e.target.value)}
              onKeyDown={(e) => teclear(i, e)}
              aria-label={`Dígito ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.principal}
          disabled={enviando || valores.some((d) => d === "")}
          onClick={() => enviar(valores.join(""))}
        >
          {enviando ? "Verificando…" : "Verificar"}
        </button>

        <button
          type="button"
          className={styles.reintento}
          onClick={reenviar}
          disabled={reenviando}
        >
          {reenviando ? "Reenviando…" : "¿No llegó? Reenviar SMS"}
        </button>

        {aviso && <p className={styles.verificado}>{aviso}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
