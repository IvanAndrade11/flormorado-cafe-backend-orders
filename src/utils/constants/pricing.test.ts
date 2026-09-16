import { describe, expect, it } from "vitest";

import {
  computeTotals,
  FREE_SHIPPING_FROM,
  parseCopPrice,
  type PricedLine,
} from "./pricing";

const line = (overrides: Partial<PricedLine> = {}): PricedLine => ({
  productId: "FLORMORADO500",
  name: "FLORMORADO CAFÉ 500 G",
  brand: "flormorado",
  size: "500",
  grinding: "Gruesa",
  quantity: 1,
  unitPrice: 45000,
  shippingPrice: 7000,
  ...overrides,
});

describe("parseCopPrice", () => {
  it("quita los puntos de miles del formato colombiano", () => {
    expect(parseCopPrice("45.000")).toBe(45000);
    expect(parseCopPrice("240.000")).toBe(240000);
  });

  it("acepta precios sin separador", () => {
    expect(parseCopPrice("500")).toBe(500);
  });
});

describe("computeTotals", () => {
  it("multiplica precio por cantidad", () => {
    const totals = computeTotals([line({ quantity: 3 })]);

    expect(totals.subtotal).toBe(135000);
  });

  it("cobra envío cuando el subtotal no llega al umbral", () => {
    const totals = computeTotals([line({ quantity: 3 })]);

    expect(totals.shipping).toBe(7000);
    expect(totals.total).toBe(142000);
  });

  it("regala el envío justo en el umbral", () => {
    const totals = computeTotals([
      line({ unitPrice: FREE_SHIPPING_FROM, quantity: 1 }),
    ]);

    expect(totals.subtotal).toBe(FREE_SHIPPING_FROM);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(FREE_SHIPPING_FROM);
  });

  it("regala el envío por encima del umbral", () => {
    const totals = computeTotals([line({ unitPrice: 240000 })]);

    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(240000);
  });

  it("suma varias líneas", () => {
    const totals = computeTotals([
      line({ unitPrice: 45000, quantity: 1 }),
      line({ productId: "OCA250", unitPrice: 35000, quantity: 2 }),
    ]);

    expect(totals.subtotal).toBe(115000);
    expect(totals.total).toBe(122000);
  });

  it("no cobra envío con el carrito vacío", () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, shipping: 0, total: 0 });
  });

  // Documenta la rareza heredada del frontend: el envío sale del primer
  // producto, no del mayor ni de la suma. Hoy no se nota porque todos comparten
  // shippingPrice; esta prueba falla el día que eso deje de ser cierto.
  it("toma el envío del primer producto del carrito", () => {
    const totals = computeTotals([
      line({ unitPrice: 10000, shippingPrice: 7000 }),
      line({ productId: "OTRO", unitPrice: 10000, shippingPrice: 99000 }),
    ]);

    expect(totals.shipping).toBe(7000);
  });
});
