export interface Env {
  DB: D1Database;
  // SDK key del frontend. No es un secreto real —viaja en el bundle público—
  // pero se guarda con `wrangler secret put` por consistencia con el resto.
  CONFIGCAT_SDK_KEY: string;
}
