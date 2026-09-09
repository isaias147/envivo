"use client";

// ⚠️ TEMPORAL — Sesión 14, paso 1. Solo para verificar el modal de login.
// Bórrala cuando "Seguir" (paso 2) dispare el modal de verdad.

import { useState } from "react";
import ModalEntrarConGoogle from "@/components/ModalEntrarConGoogle";
import { salir, useUsuario } from "@/lib/authUsuario";

export default function PruebaEntrar() {
  const [abierto, setAbierto] = useState(false);
  const { usuario, cargando } = useUsuario();

  return (
    <main
      style={{
        maxWidth: 440,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "var(--fuente-cuerpo)",
        color: "var(--hueso)",
      }}
    >
      <h1 style={{ fontFamily: "var(--fuente-titulo)", fontSize: 22 }}>
        Prueba · Modal “Entrar con Google”
      </h1>
      <p style={{ color: "var(--hueso-tenue)", fontSize: 13.5, lineHeight: 1.6 }}>
        Página temporal (Sesión 14, paso 1). El modal no está conectado a nada
        todavía.
      </p>

      <p style={{ margin: "18px 0", fontSize: 14 }}>
        Estado:{" "}
        <b>
          {cargando
            ? "comprobando…"
            : usuario
              ? `con sesión — ${usuario.email ?? usuario.id}`
              : "sin sesión"}
        </b>
      </p>

      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          background: "var(--laton)",
          color: "var(--noche)",
          border: 0,
          borderRadius: 10,
          padding: "12px 18px",
          fontFamily: "var(--fuente-titulo)",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Abrir modal
      </button>

      {usuario && (
        <button
          type="button"
          onClick={() => salir()}
          style={{
            marginLeft: 12,
            background: "transparent",
            color: "var(--hueso-tenue)",
            border: "1px solid var(--linea)",
            borderRadius: 10,
            padding: "12px 18px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      )}

      <ModalEntrarConGoogle
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Entra para seguir a La Topa Tolondra"
        descripcion="Vas a ver sus próximos eventos en «Siguiendo». No publicás nada ni es obligatorio para usar el mapa."
      />
    </main>
  );
}
