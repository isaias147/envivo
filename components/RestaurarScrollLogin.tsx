"use client";

// Al cargar la app, si venimos de un login con Google, devuelve el scroll a
// donde estaba (la URL ya vuelve sola por el `redirectTo`). Vive en el
// layout, junto a RegisterSW. No pinta nada.

import { useEffect } from "react";
import { restaurarScrollTrasLogin } from "@/lib/authUsuario";

export default function RestaurarScrollLogin() {
  useEffect(() => {
    restaurarScrollTrasLogin();
  }, []);
  return null;
}
