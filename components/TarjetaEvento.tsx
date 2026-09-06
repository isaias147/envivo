import Link from "next/link";
import { horaCali, type EventoPublico } from "@/lib/eventos";
import styles from "./TarjetaEvento.module.css";

/**
 * La tarjeta de un evento: mini flyer, hora en latón, título, sede y
 * etiquetas. Es el mismo componente en la ficha inferior del mapa (`/`)
 * y en cada renglón de la lista (`/lista`). Toda la tarjeta es un enlace
 * al detalle.
 */
export default function TarjetaEvento({ evento }: { evento: EventoPublico }) {
  const { hhmm, periodo } = horaCali(evento.starts_at);
  const precio = evento.is_free
    ? "Gratis"
    : evento.price_label ?? "Entrada paga";

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
          {evento.es_serie && (
            <span className={`${styles.tira} ${styles.serie}`}>Serie</span>
          )}
          {evento.type && <span className={styles.tira}>{evento.type}</span>}
        </div>
      </div>
    </Link>
  );
}
