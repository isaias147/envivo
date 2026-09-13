import Link from "next/link";
import { horaCali, type EventoPublico } from "@/lib/eventos";
import styles from "./TarjetaEvento.module.css";

/** "3.2 km" bajo los 10 km, entero de ahí en adelante ("14 km"). */
function formatoDistancia(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Texto del badge de edad; null (no se muestra nada) para "todo_publico". */
function textoRestriccionEdad(
  r: EventoPublico["restriccion_edad"],
): string | null {
  switch (r) {
    case "infantil":
      return "Para niños";
    case "mas_12":
      return "+12";
    case "mas_16":
      return "+16";
    case "mas_18":
      return "+18";
    default:
      return null;
  }
}

/**
 * La tarjeta de un evento: mini flyer, hora en latón, título, sede y
 * etiquetas. Es el mismo componente en la ficha inferior del mapa (`/`)
 * y en cada renglón de la lista (`/lista`). Toda la tarjeta es un enlace
 * al detalle.
 */
export default function TarjetaEvento({
  evento,
  distanciaKm,
}: {
  evento: EventoPublico;
  /** Distancia al centro actual, en km. Solo la calcula /lista. */
  distanciaKm?: number;
}) {
  const { hhmm, periodo } = horaCali(evento.starts_at);
  const precio = evento.is_free
    ? "Gratis"
    : evento.price_label ?? "Entrada paga";
  const edad = textoRestriccionEdad(evento.restriccion_edad);

  return (
    <Link href={`/evento/${evento.id}`} className={styles.tarjeta}>
      <div className={styles.mini}>
        {evento.flyer_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={evento.flyer_url} alt="" />
        )}
      </div>
      <div className={styles.cuerpo}>
        <div className={styles.hora}>
          {hhmm} <span>{periodo.toUpperCase()}</span>
        </div>
        <h3 className={styles.nombre}>{evento.title}</h3>
        {evento.venue_name && <p className={styles.sede}>{evento.venue_name}</p>}
        <div className={styles.tiras}>
          <span
            className={`${styles.tira} ${evento.is_free ? styles.libre : ""}`}
          >
            {precio}
          </span>
          {distanciaKm != null && (
            <span className={styles.tira}>{formatoDistancia(distanciaKm)}</span>
          )}
          {evento.es_serie && (
            <span className={`${styles.tira} ${styles.serie}`}>Serie</span>
          )}
          {evento.type && <span className={styles.tira}>{evento.type}</span>}
          {edad && (
            <span
              className={`${styles.tira} ${evento.restriccion_edad === "mas_18" ? styles.edad18 : ""}`}
            >
              {edad}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
