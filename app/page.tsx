import { supabase } from "@/lib/supabase";

// Esqueleto de la Sesión 1: sin pantallas todavía.
// Esta página solo comprueba que el cliente de Supabase conecta.
export const dynamic = "force-dynamic";

async function probarSupabase() {
  // Consulta mínima a la vista pública. head + count no trae filas, solo el conteo.
  const { count, error } = await supabase
    .from("eventos_publicos")
    .select("*", { count: "exact", head: true });

  if (error) {
    return { ok: false as const, mensaje: error.message };
  }
  return { ok: true as const, count: count ?? 0 };
}

export default async function Home() {
  const resultado = await probarSupabase();

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 40, color: "var(--laton)" }}>EnVivo</h1>

      <p
        style={{
          padding: "10px 16px",
          borderRadius: 999,
          border: "1px solid var(--linea)",
          background: "var(--noche-2)",
          fontSize: 15,
        }}
      >
        {resultado.ok ? (
          <>
            <span style={{ color: "var(--cana)" }}>● Supabase conecta</span>{" "}
            — la vista <code>eventos_publicos</code> respondió con{" "}
            {resultado.count} evento(s).
          </>
        ) : (
          <>
            <span style={{ color: "var(--coral)" }}>● Sin conexión con Supabase</span>{" "}
            — {resultado.mensaje}
          </>
        )}
      </p>

      <p style={{ color: "var(--hueso-tenue)", fontSize: 13, maxWidth: 320 }}>
        Esqueleto listo. Las 8 pantallas se construyen en las próximas sesiones.
      </p>
    </main>
  );
}
