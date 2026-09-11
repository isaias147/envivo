"use client";

// Pantalla · /yo — la cuenta del USUARIO FINAL (Sesión 14, paso 4).
// Sigue el slot 4 de envivo-grupo1-publico.html.
//
// Es distinta de /perfil, que es la cuenta del PUBLICADOR (cookie
// envivo_publicador). Acá la sesión es Supabase Auth (localStorage).
//
// Sin sesión → estado vacío + botón para entrar (igual que /siguiendo).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { salir } from "@/lib/authUsuario";
import { useCuentaPublicador } from "@/lib/cuentaPublicador";
import ModalEntrarConGoogle from "@/components/ModalEntrarConGoogle";
import BarraInferior from "@/components/BarraInferior";
import styles from "./page.module.css";

export default function Yo() {
  const router = useRouter();
  const {
    usuario,
    cargandoUsuario: cargando,
    perfil: perfilPublicador,
    cargandoPerfil: cargandoPerfilPublicador,
  } = useCuentaPublicador();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [avisos, setAvisos] = useState(true);
  const [nSigue, setNSigue] = useState<number | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [avisoPerfilActivo, setAvisoPerfilActivo] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cargadoParaId = useRef<string | null>(null);

  useEffect(() => {
    if (cargando || !usuario) return;
    if (cargadoParaId.current === usuario.id) return;
    cargadoParaId.current = usuario.id;

    const pref = usuario.user_metadata?.avisos;
    setAvisos(pref === undefined ? true : Boolean(pref));

    supabase
      .from("seguimientos")
      .select("perfil_id", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .then(({ count }) => setNSigue(count ?? 0));
  }, [usuario, cargando]);

  const cambiarAvisos = useCallback(async () => {
    const nuevo = !avisos;
    setAvisos(nuevo); // optimista
    const { error: e } = await supabase.auth.updateUser({
      data: { avisos: nuevo },
    });
    if (e) setAvisos(!nuevo); // revertir
  }, [avisos]);

  async function cerrarSesion() {
    await salir();
    router.push("/");
  }

  async function borrarCuenta() {
    if (borrando) return;
    setBorrando(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const r = await fetch("/api/yo/eliminar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "No se pudo borrar la cuenta.");
        setBorrando(false);
        return;
      }
      await salir(); // limpia el token local
      router.push("/");
    } catch {
      setError("Falló la conexión. Intentá de nuevo.");
      setBorrando(false);
    }
  }

  const nombre =
    (usuario?.user_metadata?.full_name as string | undefined) ??
    (usuario?.user_metadata?.name as string | undefined) ??
    usuario?.email ??
    "Tu cuenta";
  const foto =
    (usuario?.user_metadata?.avatar_url as string | undefined) ??
    (usuario?.user_metadata?.picture as string | undefined) ??
    null;

  return (
    <div className={styles.pantalla}>
      <header className={styles.top}>
        <div className={styles.marca}>
          En<i>Vivo</i>
        </div>
      </header>

      <h1 className={styles.titulo}>Tu cuenta</h1>

      {cargando ? (
        <p className={styles.info}>Cargando…</p>
      ) : !usuario ? (
        <div className={styles.vacio}>
          <p>
            Entrá con tu cuenta para manejar tus avisos y los perfiles que
            seguís.
          </p>
          <button
            type="button"
            className={styles.entrar}
            onClick={() => setModalAbierto(true)}
          >
            Entrar con Google
          </button>
        </div>
      ) : (
        <>
          <div className={styles.cabecera}>
            <span className={styles.avatar}>
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" referrerPolicy="no-referrer" />
              ) : (
                (nombre.trim()[0] ?? "?").toUpperCase()
              )}
            </span>
            <div className={styles.identidad}>
              <div className={styles.nombre}>{nombre}</div>
              {usuario.email && (
                <div className={styles.email}>{usuario.email}</div>
              )}
            </div>
          </div>

          <button
            type="button"
            className={styles.fila}
            onClick={cambiarAvisos}
            aria-pressed={avisos}
          >
            <span>
              Avisos de nuevos eventos
              <small>Cuando alguien que seguís publique algo.</small>
            </span>
            <span
              className={`${styles.switch} ${avisos ? styles.switchOn : ""}`}
              aria-hidden="true"
            />
          </button>

          <Link href="/siguiendo" className={styles.fila}>
            <span>Perfiles que seguís</span>
            <span className={styles.flecha}>
              {nSigue ?? "—"} →
            </span>
          </Link>

          {!cargandoPerfilPublicador &&
            (perfilPublicador ? (
              <>
                <Link href="/mis-eventos" className={styles.fila}>
                  <span>Mis eventos</span>
                  <span className={styles.flecha}>→</span>
                </Link>
                <Link href="/perfil" className={styles.fila}>
                  <span>Mi perfil de publicador</span>
                  <span className={styles.flecha}>→</span>
                </Link>
              </>
            ) : (
              <Link href="/registro" className={styles.fila}>
                <span>
                  Quiero publicar
                  <small>Anunciá tus eventos en el mapa.</small>
                </span>
                <span className={styles.flecha}>→</span>
              </Link>
            ))}

          <button
            type="button"
            className={`${styles.fila} ${styles.rojo}`}
            onClick={cerrarSesion}
          >
            <span>Cerrar sesión</span>
          </button>

          {avisoPerfilActivo ? (
            <div className={styles.borrarCaja}>
              <p>
                Tenés un perfil de publicador activo; escribinos para
                cerrarlo.
              </p>
              <button
                type="button"
                className={styles.cancelar}
                onClick={() => setAvisoPerfilActivo(false)}
              >
                Entendido
              </button>
            </div>
          ) : !confirmarBorrar ? (
            <button
              type="button"
              className={`${styles.fila} ${styles.rojo}`}
              onClick={() =>
                perfilPublicador
                  ? setAvisoPerfilActivo(true)
                  : setConfirmarBorrar(true)
              }
            >
              <span>Borrar mi cuenta</span>
            </button>
          ) : (
            <div className={styles.borrarCaja}>
              <p>
                Esto borra tu cuenta y todo lo que seguís. No se puede
                deshacer.
              </p>
              <button
                type="button"
                className={styles.borrarConfirm}
                onClick={borrarCuenta}
                disabled={borrando}
              >
                {borrando ? "Borrando…" : "Borrar definitivamente"}
              </button>
              <button
                type="button"
                className={styles.cancelar}
                onClick={() => setConfirmarBorrar(false)}
                disabled={borrando}
              >
                Cancelar
              </button>
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}
        </>
      )}

      <ModalEntrarConGoogle
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Entra a EnVivo"
        descripcion="Con tu cuenta seguís a locales, organizadores y artistas y recibís un aviso cuando publican algo nuevo."
      />

      <BarraInferior />
    </div>
  );
}
