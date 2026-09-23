// Logo de EnVivo (skill envivo-ui): símbolo + logotipo "Envivo" (700) y
// "App" (500, --texto-secundario) en Plus Jakarta Sans. Toma el tamaño de
// letra del contenedor; el símbolo mide 1.2em de alto.

import styles from "./Logo.module.css";

export default function Logo({ soloSimbolo = false }: { soloSimbolo?: boolean }) {
  return (
    <span className={styles.logo}>
      {/* Símbolo según el modo del sistema (envivo-ui). */}
      <picture className={styles.picture}>
        <source srcSet="/brand/simbolo-color-claro.svg" media="(prefers-color-scheme: light)" />
        <img
          src="/brand/simbolo-color-oscuro.svg"
          alt={soloSimbolo ? "EnVivo" : ""}
          className={styles.simbolo}
        />
      </picture>
      {!soloSimbolo && (
        <span className={styles.texto}>
          Envivo<span className={styles.app}>App</span>
        </span>
      )}
    </span>
  );
}
