// Debe coincidir con BOGOTA_NEARBY_CITIES del frontend: el negocio entrega en
// moto, así que el alcance es Bogotá y municipios aledaños.
export const DELIVERY_CITIES = [
  "bogota",
  "soacha",
  "chia",
  "cota",
  "cajica",
  "la-calera",
  "mosquera",
  "funza",
] as const;

export const DOCUMENT_TYPES = ["CC", "CE", "NIT", "PA"] as const;

export const PAYMENT_METHODS = ["cash_on_delivery", "bre_b"] as const;

// En contraentrega el pago ocurre al entregar, así que 'pago_confirmado' no
// aplica: solo tiene sentido cuando hay una transferencia BRE-B que verificar.
export const ORDER_FLOW = {
  cash_on_delivery: ["nuevo", "en_preparacion", "por_entregar", "entregado"],
  bre_b: [
    "nuevo",
    "pago_confirmado",
    "en_preparacion",
    "por_entregar",
    "entregado",
  ],
} as const;

export const CANCELLED = "cancelado" as const;
