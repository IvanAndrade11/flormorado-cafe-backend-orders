import { z } from "zod";

import { DELIVERY_CITIES, DOCUMENT_TYPES } from "@/utils/constants";

// Las reglas replican las de CONTACT/DELIVERY/PAYMENT_FORM_FIELDS del frontend.
// Si el backend fuera más estricto rechazaría pedidos que el checkout dio por
// válidos, y el cliente vería un error sin poder corregirlo.

const contact = z.object({
  name: z.string().trim().min(3).max(20),
  surname: z.string().trim().min(3).max(20),
  // Mismo patrón que el frontend, no el validador de email de Zod: uno más
  // estricto rechazaría correos que el checkout ya aceptó.
  email: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^.+@.+\.[a-zA-Z]{2,}$/, "correo electrónico inválido"),
  phone: z
    .string()
    .regex(/^3[0-9]{9}$/, "celular colombiano de 10 dígitos, ej: 3001234567"),
  whatsappOptIn: z.boolean().default(false),
  // Qué versión del texto de la casilla de novedades vio el cliente: es la
  // prueba de lo que aceptó. Opcional porque el backend se despliega solo al
  // mezclar y el frontend a mano; un checkout anterior no la envía y no puede
  // quedar rechazando pedidos mientras se actualiza.
  marketingConsentVersion: z.string().trim().min(1).max(40).optional(),
});

const delivery = z.object({
  city: z.enum(DELIVERY_CITIES),
  neighborhood: z.string().trim().min(3).max(30),
  address: z.string().trim().min(8).max(60),
  additionalInfo: z.string().trim().max(60).optional(),
});

const identity = {
  documentType: z.enum(DOCUMENT_TYPES),
  documentNumber: z.string().regex(/^[0-9]{5,15}$/, "documento inválido"),
  notifyByWhatsApp: z.boolean().default(false),
};

// Union discriminada en vez de un breKey opcional suelto: así la llave BRE-B es
// obligatoria cuando el método la necesita e inválida cuando no, que es lo
// mismo que hace el `showWhen` del formulario, pero verificado.
const payment = z.discriminatedUnion("method", [
  z.object({ method: z.literal("cash_on_delivery"), ...identity }),
  z.object({
    method: z.literal("bre_b"),
    breKey: z.string().trim().min(6).max(60),
    ...identity,
  }),
]);

// El precio que el navegador mostró. No se usa para cobrar — se compara contra
// el catálogo para detectar un carrito viejo cuyos precios ya cambiaron.
const item = z.object({
  productId: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(50),
  grinding: z.string().trim().min(1).max(40),
  unitPrice: z.number().int().nonnegative(),
});

export const orderRequestSchema = z.object({
  // Identifica el intento de compra. El navegador la genera una vez y la
  // reenvía en cada reintento, para que un fallo de red no cree dos pedidos.
  idempotencyKey: z.string().uuid(),
  contact,
  delivery,
  payment,
  items: z.array(item).min(1).max(50),
  declaredTotal: z.number().int().nonnegative(),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;
export type OrderItemRequest = z.infer<typeof item>;
