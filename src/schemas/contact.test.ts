import { describe, expect, it } from "vitest";

import { contactRequestSchema } from "./contact";

const valid = {
  name: "María",
  email: "maria@example.com",
  subject: "producto",
  message: "Quisiera saber si tienen café descafeinado disponible.",
};

describe("contactRequestSchema", () => {
  it("acepta un mensaje sin teléfono", () => {
    const result = contactRequestSchema.safeParse(valid);

    expect(result.success).toBe(true);
    expect(result.data?.phone).toBeUndefined();
  });

  it("acepta un mensaje con teléfono colombiano", () => {
    const result = contactRequestSchema.safeParse({
      ...valid,
      phone: "3001234567",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un teléfono que no es colombiano", () => {
    const result = contactRequestSchema.safeParse({
      ...valid,
      phone: "12345",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un asunto fuera de las opciones del formulario", () => {
    const result = contactRequestSchema.safeParse({
      ...valid,
      subject: "otro-no-listado",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un mensaje demasiado corto", () => {
    const result = contactRequestSchema.safeParse({
      ...valid,
      message: "hola",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un correo con formato inválido", () => {
    const result = contactRequestSchema.safeParse({
      ...valid,
      email: "no-es-un-correo",
    });

    expect(result.success).toBe(false);
  });
});
