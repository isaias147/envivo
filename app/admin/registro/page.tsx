"use client";

// /admin/registro — confirmación manual de códigos de verificación.
// Camino B de la Sesión 12: el publicador manda su código por WhatsApp al
// número de EnVivo; acá el equipo lo empareja y lo confirma. Al confirmar,
// el polling de /registro/verificar deja pasar a esa persona.
//
// Toda escritura pasa por /api/admin/registro/* (nunca Supabase desde aquí).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearWhatsapp } from "@/lib/eventos";
import styles from "./page.module.css";

type Pendiente = {
  id: string;
  whatsapp: string;
  codigo: string;
  created_at: string;
  expires_at: string;
  intentos: number | null;
};
type Confirmado = { id: string; whatsapp: string; codigo: string; used_at: string };

function haceCuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

export default function AdminRegistro() {
  const router = useRouter();
  const [revisando, setRevisando] = useState(true);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [confirmados, setConfirmados] = useState<Confirmado[]>([]);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/registro/pendientes", {
        cache: "no-store",
      });
      if (r.status === 401) {
        router.replace("/admin");
        return;
      }
      const j = await r.json();
      setPendientes(j.pendientes ?? []);
      setConfirmados(j.confirmadosRecientes ?? []);
    } catch {
      // reintenta en el siguiente tick
    } finally {
      setRevisando(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      await cargar();
    })();
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [cargar]);

  async function confirmar(p: Pendiente) {
    if (trabajando) return;
    setError(null);
    setTrabajando(p.id);
    try {
      const r = await fetch("/api/admin/registro/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: p.whatsapp, codigo: p.codigo }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "No se pudo confirmar.");
      await cargar();
    } catch {
      setError("Falló la conexión.");
    }
    setTrabajando(null);
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
      <div className={styles.cabecera}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
        <a className={styles.volver} href="/admin/cola">
          ← Cola
        </a>
      </div>

      <h1 className={styles.titulo}>Códigos por confirmar</h1>
      <p className={styles.ayuda}>
        Cuando llegue un mensaje al WhatsApp de EnVivo, buscá acá el número y
        confirmá que el código coincide con el del mensaje.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {pendientes.length === 0 ? (
        <p className={styles.vacio}>Nada pendiente ahora mismo.</p>
      ) : (
        <ul className={styles.lista}>
          {pendientes.map((p) => (
            <li key={p.id} className={styles.fila}>
              <div>
                <div className={styles.numero}>
                  {formatearWhatsapp(p.whatsapp)}
                </div>
                <div className={styles.meta}>
                  {haceCuanto(p.created_at)}
                  {(p.intentos ?? 0) > 0 && ` · ${p.intentos} intento(s)`}
                </div>
              </div>
              <div className={styles.codigo}>{p.codigo}</div>
              <button
                className={styles.confirmar}
                onClick={() => confirmar(p)}
                disabled={trabajando === p.id}
              >
                {trabajando === p.id ? "…" : "Confirmar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmados.length > 0 && (
        <>
          <h2 className={styles.subtitulo}>Confirmados (últimas 2 h)</h2>
          <ul className={styles.lista}>
            {confirmados.map((c) => (
              <li key={c.id} className={`${styles.fila} ${styles.hecha}`}>
                <div className={styles.numero}>
                  {formatearWhatsapp(c.whatsapp)}
                </div>
                <div className={styles.codigo}>{c.codigo}</div>
                <div className={styles.ok}>✓ {haceCuanto(c.used_at)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
