import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-leaflet 5 crea el mapa en un callback de ref y no limpia bien el
  // contenedor cuando React StrictMode lo monta dos veces en desarrollo
  // ("Map container is being reused by another instance"). Apagamos StrictMode
  // para que el mapa se monte una sola vez. No afecta a producción.
  reactStrictMode: false,
};

export default nextConfig;
