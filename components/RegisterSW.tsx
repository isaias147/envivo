"use client";

import { useEffect } from "react";

// Registra el service worker para que la app sea instalable (PWA).
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

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
