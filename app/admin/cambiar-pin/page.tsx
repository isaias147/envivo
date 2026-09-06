"use client";

// Pantalla · /admin/cambiar-pin — el equipo entra la primera vez con un
// PIN provisional (`must_change_pin` en la tabla `admins`). Aquí lo cambia
// por uno propio de 4 dígitos antes de llegar a la cola.
//
// El cambio ocurre en el servidor (POST /api/admin/cambiar-pin), que llama
// a la función `cambiar_pin_admin`. Esta pantalla solo pide el PIN actual
// (como comprobación) y el nuevo dos veces.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../page.module.css";

export default function CambiarPin() {
  const router = useRouter();
  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [repetir, setRepetir] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(true);

  // Sin sesión no hay nada que cambiar: al login.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/sesion", { cache: "no-store" });
        const j = await r.json();
        if (!vivo) return;
        if (!j.activa) {
          router.replace("/admin");
          return;
        }
        // Si ya no debe cambiarlo, no tiene sentido quedarse aquí.
        if (!j.debeCambiarPin) {
          router.replace("/admin/cola");
          return;
        }
      } catch {
        // sin conexión: dejamos el formulario visible
      }
      if (vivo) setRevisando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  const soloDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    if (!/^\d{4}$/.test(pinNuevo)) {
      setError("El PIN nuevo debe ser de 4 dígitos.");
      return;
    }
    if (pinNuevo !== repetir) {
      setError("El PIN nuevo y su repetición no coinciden.");
      return;
    }
    if (pinNuevo === pinActual) {
      setError("El PIN nuevo tiene que ser distinto del actual.");
      return;
    }

    setEnviando(true);
    try {
      const r = await fetch("/api/admin/cambiar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinActual, pinNuevo }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo cambiar el PIN.");
        setEnviando(false);
        return;
      }
      router.replace("/admin/cola");
    } catch {
      setError("Falló la conexión. Intenta de nuevo.");
      setEnviando(false);
    }
  }

  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
  }

  if (revisando) {
    return (
      <div className={styles.pantalla}>
        <p className={styles.cargando}>Cargando…</p>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      <form className={styles.tarjeta} onSubmit={guardar}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <h1 className={styles.titulo}>Cambia tu PIN</h1>
        <p className={styles.bajada}>
          Entraste con un PIN provisional. Elige uno propio de 4 dígitos para
          seguir.
        </p>

        <label className={styles.etiqueta} htmlFor="pin-actual">
          PIN actual
        </label>
        <input
          id="pin-actual"
          className={styles.pin}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="••••"
          value={pinActual}
          onChange={(e) => {
            setPinActual(soloDigitos(e.target.value));
            setError(null);
          }}
        />

        <label className={styles.etiqueta} htmlFor="pin-nuevo">
          PIN nuevo
        </label>
        <input
          id="pin-nuevo"
          className={styles.pin}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="••••"
          value={pinNuevo}
          onChange={(e) => {
            setPinNuevo(soloDigitos(e.target.value));
            setError(null);
          }}
        />

        <label className={styles.etiqueta} htmlFor="pin-repetir">
          Repite el PIN nuevo
        </label>
        <input
          id="pin-repetir"
          className={styles.pin}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="••••"
          value={repetir}
          onChange={(e) => {
            setRepetir(soloDigitos(e.target.value));
            setError(null);
          }}
        />

        <button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar PIN"}
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.enlaceSalir} onClick={salir}>
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
