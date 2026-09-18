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

export const ORDER_STATUSES = [
  "nuevo",
  "pago_confirmado",
  "en_preparacion",
  "por_entregar",
  "entregado",
  "cancelado",
] as const;

/**
 * Próximos estados válidos desde el estado y método de pago actuales. El
 * panel solo debería ofrecer estos como opción, pero quien de verdad lo exige
 * es `updateOrderStatus` en el backend — nunca confiar en lo que mande el
 * panel, igual que nunca se confía en el total que manda el navegador.
 */
export const nextStatuses = (
  paymentMethod: (typeof PAYMENT_METHODS)[number],
  current: string,
): string[] => {
  if (current === CANCELLED) return [];

  const flow: readonly string[] = ORDER_FLOW[paymentMethod];
  const index = flow.indexOf(current);
  if (index === -1) return [CANCELLED];

  const forward = index < flow.length - 1 ? [flow[index + 1]] : [];
  return [...forward, CANCELLED];
};
