import Link from "next/link";
import { TIPOS_PERFIL } from "@/lib/tiposPerfil";
import type { ResultadoBusqueda } from "@/lib/busqueda";
import styles from "./TarjetaLugar.module.css";

const ETIQUETA_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_PERFIL.map((t) => [t.valor, t.titulo]),
);

/**
 * La tarjeta de un perfil (local, organizador o artista) que devolvió el
 * buscador. Mismo estilo visual que TarjetaEvento; ocupa el mismo lugar en
 * la ficha del mapa, pero sin hora ni tiras de precio (un perfil no las
 * tiene).
 */
export default function TarjetaLugar({
  resultado,
}: {
  resultado: ResultadoBusqueda;
}) {
  const etiqueta = resultado.subtitulo
    ? (ETIQUETA_TIPO[resultado.subtitulo] ?? resultado.subtitulo)
    : null;

  return (
    <div className={styles.tarjeta}>
      <div className={styles.mini}>
        {resultado.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resultado.imagen_url} alt="" />
        )}
      </div>
      <div className={styles.cuerpo}>
        {etiqueta && <p className={styles.tipo}>{etiqueta}</p>}
        <h3 className={styles.nombre}>{resultado.titulo}</h3>
        {resultado.slug && (
          <Link href={`/p/${resultado.slug}`} className={styles.boton}>
            Ver perfil
          </Link>
        )}
      </div>
    </div>
  );
}
