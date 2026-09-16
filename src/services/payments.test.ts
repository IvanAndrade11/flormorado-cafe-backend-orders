import { describe, expect, it } from "vitest";

import { breBInstructions } from "./payments";

const env = { BREB_KEY: "@flormorado", BREB_HOLDER: "Flormorado Café" };

describe("breBInstructions", () => {
  it("devuelve la llave y el titular para un pago por BRE-B", () => {
    expect(breBInstructions(env, "bre_b")).toEqual({
      llave: "@flormorado",
      titular: "Flormorado Café",
    });
  });

  it("no devuelve nada para contraentrega", () => {
    expect(breBInstructions(env, "cash_on_delivery")).toBeUndefined();
  });
});
