// Candado de contacto: Instagram y WhatsApp público quedan bloqueados 30
// días desde el último cambio (`perfiles.ultimo_cambio_contacto`). El nombre
// no tiene candado. Lo calculan /perfil (para pintar) y la API de guardado
// (para validar server-side, sin confiar en el frontend).
//
// Extraído de lib/registroPublicador.ts cuando el alta del publicador se
// migró a envivo-publisher: esto es lógica pura (sin Supabase ni
// service_role) que sigue haciendo falta acá para /perfil, la pantalla del
// publicador ya registrado.

export const VENTANA_CANDADO_DIAS = 30;

export function candadoContacto(ultimoCambio: string | null | undefined): {
  bloqueado: boolean;
  desbloqueaEn: string | null;
} {
  if (!ultimoCambio) return { bloqueado: false, desbloqueaEn: null };
  const desbloqueo = new Date(
    new Date(ultimoCambio).getTime() +
      VENTANA_CANDADO_DIAS * 24 * 60 * 60 * 1000,
  );
  return {
    bloqueado: desbloqueo.getTime() > Date.now(),
    desbloqueaEn: desbloqueo.toISOString(),
  };
}
