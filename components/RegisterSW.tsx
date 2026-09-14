"use client";

import { useEffect } from "react";

// Registra el service worker para que la app sea instalable (PWA) — solo
// en producción. En `next dev` (Turbopack) los hashes de los chunks
// cambian en cada reinicio/reinstalo; un service worker de una sesión de
// dev anterior queda interceptando esas peticiones y puede dejar colgada
// una importación dinámica (por ejemplo la del mapa). Por eso en
// desarrollo no se registra uno nuevo y además se desregistra cualquiera
// que haya quedado de antes.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registros) => registros.forEach((r) => r.unregister()));
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("No se pudo registrar el service worker:", err));
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
