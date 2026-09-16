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
}
