import Link from "next/link";
import { horaCali, type EventoPublico } from "@/lib/eventos";
import styles from "./TarjetaEvento.module.css";

/** "3.2 km" bajo los 10 km, entero de ahí en adelante ("14 km"). */
function formatoDistancia(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Texto y color del badge de edad. Siempre hay uno (incluido
 * "todo_publico", verde): verde = sin restricción o infantil, amarillo =
 * +12/+16, rojo (edad18) = +18.
 */
function datosRestriccionEdad(
  r: EventoPublico["restriccion_edad"],
): { texto: string; clase: "edadVerde" | "edadAmarilla" | "edad18" } {
  switch (r) {
    case "infantil":
      return { texto: "Infantil", clase: "edadVerde" };
    case "mas_12":
      return { texto: "+12", clase: "edadAmarilla" };
    case "mas_16":
      return { texto: "+16", clase: "edadAmarilla" };
    case "mas_18":
      return { texto: "+18", clase: "edad18" };
    default:
      return { texto: "Todo público", clase: "edadVerde" };
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
  id,
}: {
  evento: EventoPublico;
  /** Distancia al centro actual, en km. Solo la calcula /lista. */
  distanciaKm?: number;
  /** Id del elemento raíz — lo usa /lista para enfocar la tarjeta desde el buscador. */
  id?: string;
}) {
  const { hhmm, periodo } = horaCali(evento.starts_at);
  const precio = evento.is_free
    ? "Gratis"
    : evento.price_label ?? "Entrada paga";
  const edad = datosRestriccionEdad(evento.restriccion_edad);

  return (
    <Link id={id} href={`/evento/${evento.id}`} className={styles.tarjeta}>
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
          <span className={`${styles.tira} ${styles[edad.clase]}`}>
            {edad.texto}
          </span>
          {evento.pet_friendly === true && (
            <span className={styles.tira}>Pet friendly</span>
          )}
        </div>
      </div>
    </Link>
  );
}
