"use client";

// Envoltura de cliente para MapaPerfil: hace la carga con ssr:false (Leaflet
// necesita `window`). Se separa así porque `next/dynamic({ ssr:false })` no
// se puede llamar desde un Server Component, y /p/[slug] lo es.

import dynamic from "next/dynamic";
import type { PuntoPerfil } from "./MapaPerfil";

const MapaPerfil = dynamic(() => import("./MapaPerfil"), { ssr: false });

export default function MapaPerfilLazy({ puntos }: { puntos: PuntoPerfil[] }) {
  return <MapaPerfil puntos={puntos} />;
}
