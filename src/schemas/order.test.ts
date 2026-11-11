import { describe, expect, it } from "vitest";

import { orderRequestSchema } from "./order";

const valid = {
  idempotencyKey: "3f6d6d3e-8a6e-4d5e-9c7a-1b2c3d4e5f60",
  contact: {
    name: "María",
    surname: "Restrepo",
    email: "maria@example.com",
    phone: "3001234567",
  },
  delivery: {
    city: "chia",
    neighborhood: "Centro",
    address: "Calle 12 # 4-56",
  },
  payment: {
    method: "cash_on_delivery",
    documentType: "CC",
    documentNumber: "1012345678",
  },
  items: [
    {
      productId: "FLORMORADO500",
      quantity: 1,
      grinding: "Gruesa",
      unitPrice: 45000,
    },
  ],
  declaredTotal: 52000,
};

describe("orderRequestSchema", () => {
  // El backend se despliega solo al mezclar y el frontend a mano: un checkout
  // anterior que todavía envía los campos de WhatsApp no puede quedar
  // rechazando pedidos.
  it("ignora los campos de WhatsApp que un checkout anterior aún envía", () => {
    const result = orderRequestSchema.safeParse({
      ...valid,
      contact: {
        ...valid.contact,
        whatsappOptIn: true,
        marketingConsentVersion: "2026-09-16",
      },
      payment: { ...valid.payment, notifyByWhatsApp: true },
    });

    expect(result.success).toBe(true);
    expect(result.data?.contact).not.toHaveProperty("whatsappOptIn");
  });

  it("exige la llave del cliente cuando paga por BRE-B", () => {
    const result = orderRequestSchema.safeParse({
      ...valid,
      payment: { ...valid.payment, method: "bre_b" },
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un celular que no es colombiano", () => {
    const result = orderRequestSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, phone: "12345" },
    });

    expect(result.success).toBe(false);
  });
});
