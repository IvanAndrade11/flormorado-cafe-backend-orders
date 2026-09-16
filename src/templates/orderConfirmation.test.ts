import { describe, expect, it } from "vitest";

import type { OrderRequest } from "@/schemas/order";
import type { PricedLine } from "@/utils/constants";

import { confirmationHtml } from "./orderConfirmation";

const lines: PricedLine[] = [
  {
    productId: "FLORMORADO500",
    name: "FLORMORADO CAFÉ 500 G",
    brand: "flormorado",
    size: "500",
    grinding: "Gruesa",
    quantity: 1,
    unitPrice: 45000,
    shippingPrice: 7000,
  },
];

const totals = { subtotal: 45000, shipping: 7000, total: 52000 };

const request = (payment: OrderRequest["payment"]): OrderRequest => ({
  idempotencyKey: "3f6d6d3e-8a6e-4d5e-9c7a-1b2c3d4e5f60",
  contact: {
    name: "María",
    surname: "Restrepo",
    email: "maria@example.com",
    phone: "3001234567",
    whatsappOptIn: false,
  },
  delivery: {
    city: "chia",
    neighborhood: "Centro",
    address: "Calle 12 # 4-56",
  },
  payment,
  items: [],
  declaredTotal: 52000,
});

const identity = {
  documentType: "CC" as const,
  documentNumber: "1012345678",
  notifyByWhatsApp: false,
};

describe("confirmationHtml", () => {
  it("indica cuánto tener en efectivo en contraentrega", () => {
    const html = confirmationHtml({
      orderId: "FM-20260916-001",
      request: request({ method: "cash_on_delivery", ...identity }),
      lines,
      totals,
    });

    expect(html).toContain("en efectivo");
    expect(html).not.toContain("llave BRE-B");
  });

  it("dice a qué llave transferir, qué nombre verificar y qué escribir", () => {
    const html = confirmationHtml({
      orderId: "FM-20260916-002",
      request: request({ method: "bre_b", breKey: "@maria", ...identity }),
      lines,
      totals,
      paymentInstructions: { llave: "@flormorado", titular: "Flormorado Café" },
    });

    expect(html).toContain("@flormorado");
    expect(html).toContain("Flormorado Café");
    expect(html).toContain("tu número de pedido, <strong>FM-20260916-002");
    expect(html).toContain("52.000");
  });

  it("escapa los datos de pago antes de meterlos en el correo", () => {
    const html = confirmationHtml({
      orderId: "FM-20260916-003",
      request: request({ method: "bre_b", breKey: "@maria", ...identity }),
      lines,
      totals,
      paymentInstructions: {
        llave: "@x",
        titular: "<script>alert(1)</script>",
      },
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("no inventa una llave si faltan las instrucciones", () => {
    const html = confirmationHtml({
      orderId: "FM-20260916-004",
      request: request({ method: "bre_b", breKey: "@maria", ...identity }),
      lines,
      totals,
    });

    expect(html).toContain("Te contactaremos para completar el pago");
  });
});
