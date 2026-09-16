import { describe, expect, it } from "vitest";

import { orderRequestSchema } from "./order";

const valid = {
  idempotencyKey: "3f6d6d3e-8a6e-4d5e-9c7a-1b2c3d4e5f60",
  contact: {
    name: "María",
    surname: "Restrepo",
    email: "maria@example.com",
    phone: "3001234567",
    whatsappOptIn: true,
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
    notifyByWhatsApp: false,
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
  // que todavía no envía la versión del consentimiento no puede quedar
  // rechazando pedidos.
  it("acepta un pedido sin versión del consentimiento", () => {
    const result = orderRequestSchema.safeParse(valid);

    expect(result.success).toBe(true);
    expect(result.data?.contact.marketingConsentVersion).toBeUndefined();
  });

  it("conserva la versión del consentimiento cuando llega", () => {
    const result = orderRequestSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, marketingConsentVersion: "2026-09-16" },
    });

    expect(result.data?.contact.marketingConsentVersion).toBe("2026-09-16");
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
