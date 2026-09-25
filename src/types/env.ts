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
  // Cadena que inventamos nosotros; Meta la devuelve al verificar la URL de
  // devolución de llamada, para confirmar que el endpoint es nuestro.
  WHATSAPP_VERIFY_TOKEN: string;
  // Secreto de la app de Meta (Configuración básica > App secret), usado para
  // validar que cada POST del webhook viene realmente de Meta.
  WHATSAPP_APP_SECRET: string;
  // Clave del panel de pedidos (fase 4). El frontend la manda como
  // `Authorization: Bearer <clave>` en cada llamada a /admin/*; nunca viaja en
  // el bundle público.
  ADMIN_PASSWORD: string;
  // Secreto del widget de Turnstile (Cloudflare → Turnstile). Mientras no
  // exista, el backend no exige el token: así se puede desplegar antes que el
  // frontend, que se publica a mano, sin rechazar los pedidos de la tienda.
  TURNSTILE_SECRET_KEY?: string;
  // Limitadores de `wrangler.toml` (`[[ratelimits]]`). Son opcionales en el
  // tipo porque en pruebas y en `wrangler dev` sin configurar no existen, y el
  // servicio debe seguir funcionando sin ellos.
  ORDER_IP_LIMITER?: RateLimit;
  ORDER_EMAIL_LIMITER?: RateLimit;
  CONTACT_IP_LIMITER?: RateLimit;
  ADMIN_IP_LIMITER?: RateLimit;
}
