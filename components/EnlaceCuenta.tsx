"use client";

// Acceso a /yo (cuenta del usuario final) desde la barra superior de /,
// /lista y /siguiendo. Muestra el avatar de Google si hay sesión, o un
// ícono genérico si no. `/yo` no es un tab de la barra inferior (spec).

import Link from "next/link";
import { useUsuario } from "@/lib/authUsuario";
import styles from "./EnlaceCuenta.module.css";

export default function EnlaceCuenta({ className }: { className?: string }) {
  const { usuario } = useUsuario();
  const foto =
    (usuario?.user_metadata?.avatar_url as string | undefined) ??
    (usuario?.user_metadata?.picture as string | undefined) ??
    null;

  return (
    <Link
      href="/yo"
      className={`${styles.enlace} ${className ?? ""}`}
      aria-label="Mi cuenta"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" referrerPolicy="no-referrer" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )}
    </Link>
  );
}
