export interface Env {
  DB: D1Database;
  // SDK key del frontend. No es un secreto real —viaja en el bundle público—
  // pero se guarda con `wrangler secret put` por consistencia con el resto.
  CONFIGCAT_SDK_KEY: string;
  RESEND_API_KEY: string;
  // Remitente verificado en Resend; va como variable en wrangler.toml porque
  // aparece en cada correo que enviamos.
  ORDERS_EMAIL_FROM: string;
  // Buzón del negocio que recibe el resumen. Va como secreto para no publicar
  // un correo privado en un repositorio abierto.
  ORDERS_EMAIL_TO: string;
  // Orígenes autorizados para llamar al endpoint desde un navegador, separados
  // por coma. Es una lista y no un valor único para poder probar desde otro
  // origen sin cambiar código.
  ALLOWED_ORIGINS: string;
  // Llave BRE-B de la empresa y titular que el cliente ve al confirmar la
  // transferencia. Van como variables en wrangler.toml a propósito: no son
  // secretas, y tenerlas en git deja rastro si alguien las cambia.
  BREB_KEY: string;
  BREB_HOLDER: string;
}
