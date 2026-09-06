"use client";

// Pantalla 7 · /admin — entrada al panel de revisión.
// Sigue el bloque "1 · Entrar" de envivo-panel-admin.html: número + PIN.
// La validación ocurre en el servidor (POST /api/admin/login), que compara
// el PIN con `verificar_admin` y deja una cookie firmada. Aquí no se toca
// ni la service_role key ni la tabla `admins`.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(true);

  // Si ya hay sesión, saltar directo a la cola.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/sesion", { cache: "no-store" });
        const j = await r.json();
        if (vivo && j.activa) {
          router.replace(j.debeCambiarPin ? "/admin/cambiar-pin" : "/admin/cola");
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

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, pin }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo entrar.");
        setEnviando(false);
        return;
      }
      router.replace(j.debeCambiarPin ? "/admin/cambiar-pin" : "/admin/cola");
    } catch {
      setError("Falló la conexión. Intenta de nuevo.");
      setEnviando(false);
    }
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
      <form className={styles.tarjeta} onSubmit={entrar}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <h1 className={styles.titulo}>Panel de revisión</h1>
        <p className={styles.bajada}>
          Solo para el equipo. Entra con tu número y tu clave.
        </p>

        <label className={styles.etiqueta} htmlFor="telefono">
          Teléfono
        </label>
        <input
          id="telefono"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder="300 123 4567"
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value);
            setError(null);
          }}
        />

        <label className={styles.etiqueta} htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          className={styles.pin}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="••••"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />

        <button type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </form>
    </div>
  );
}
