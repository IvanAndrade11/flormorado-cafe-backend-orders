// Debe coincidir con BOGOTA_NEARBY_CITIES del frontend: el negocio entrega en
// moto, así que el alcance es Bogotá y municipios aledaños.
export const CITY_LABELS = {
  bogota: "Bogotá D.C.",
  soacha: "Soacha",
  chia: "Chía",
  cota: "Cota",
  cajica: "Cajicá",
  "la-calera": "La Calera",
  mosquera: "Mosquera",
  funza: "Funza",
} as const;

export const DELIVERY_CITIES = Object.keys(CITY_LABELS) as [
  keyof typeof CITY_LABELS,
  ...(keyof typeof CITY_LABELS)[],
];

export const PAYMENT_LABELS = {
  cash_on_delivery: "Pago contraentrega",
  bre_b: "Llave BRE-B",
} as const;

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
