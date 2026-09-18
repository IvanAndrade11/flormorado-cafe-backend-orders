import { describe, expect, it } from "vitest";

import type { ContactRequest } from "@/schemas/contact";

import {
  contactNotificationHtml,
  contactNotificationSubject,
} from "./contactNotification";

const request: ContactRequest = {
  name: "María",
  email: "maria@example.com",
  subject: "mayoristas",
  message: "¿Cómo puedo convertirme en aliado comercial?",
};

describe("contactNotificationSubject", () => {
  it("incluye la etiqueta legible del asunto", () => {
    expect(contactNotificationSubject("mayoristas")).toBe(
      "Nuevo mensaje de contacto — Ventas al por mayor / aliados",
    );
  });
});

describe("contactNotificationHtml", () => {
  it("incluye los datos de contacto y el mensaje", () => {
    const html = contactNotificationHtml(request);

    expect(html).toContain("María");
    expect(html).toContain("maria@example.com");
    expect(html).toContain("¿Cómo puedo convertirme en aliado comercial?");
  });

  it("no incluye la fila de teléfono cuando no llega", () => {
    const html = contactNotificationHtml(request);

    expect(html).not.toContain("Teléfono");
  });

  it("incluye el teléfono cuando llega", () => {
    const html = contactNotificationHtml({ ...request, phone: "3001234567" });

    expect(html).toContain("3001234567");
  });

  it("escapa el mensaje antes de meterlo en el correo", () => {
    const html = contactNotificationHtml({
      ...request,
      message: "<script>alert(1)</script>",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
