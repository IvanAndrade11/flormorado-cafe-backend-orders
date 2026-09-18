import { z } from "zod";

// Las reglas replican las de Contact.tsx del frontend (minLength/maxLength y
// pattern de cada campo). Si el backend fuera más estricto rechazaría
// mensajes que el formulario dio por válidos, y el cliente vería un error sin
// poder corregirlo.

export const CONTACT_SUBJECTS = [
  "pedido",
  "producto",
  "mayoristas",
  "prensa",
  "otro",
] as const;

export const CONTACT_SUBJECT_LABELS: Record<
  (typeof CONTACT_SUBJECTS)[number],
  string
> = {
  pedido: "Estado de un pedido",
  producto: "Preguntas sobre un producto",
  mayoristas: "Ventas al por mayor / aliados",
  prensa: "Prensa y medios",
  otro: "Otro",
};

export const contactRequestSchema = z.object({
  name: z.string().trim().min(3).max(40),
  // Mismo patrón que el frontend, no el validador de email de Zod: uno más
  // estricto rechazaría correos que el formulario ya aceptó.
  email: z
    .string()
    .trim()
    .min(5)
    .max(100)
    .regex(/^.+@.+\.[a-zA-Z]{2,}$/, "correo electrónico inválido"),
  phone: z
    .string()
    .regex(/^3[0-9]{9}$/, "celular colombiano de 10 dígitos, ej: 3001234567")
    .optional(),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(10).max(1000),
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;
