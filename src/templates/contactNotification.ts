import { CONTACT_SUBJECT_LABELS } from "@/schemas/contact";
import type { ContactRequest } from "@/schemas/contact";

// Mismos estilos en línea que orderConfirmation.ts: el correo se ve en el
// buzón del negocio, así que corre el mismo riesgo de que Gmail u Outlook
// descarten un <style>.
const PLUM = "#6d2649";
const INK = "#3b2314";
const MUTED = "#8a7566";
const RULE = "#e8e0d0";

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const row = (label: string, value: string) => `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid ${RULE};color:${MUTED};font-size:12px;letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap;vertical-align:top">
      ${label}
    </td>
    <td style="padding:8px 0 8px 16px;border-bottom:1px solid ${RULE};color:${INK};font-size:15px">
      ${value}
    </td>
  </tr>`;

export const contactNotificationSubject = (
  subject: ContactRequest["subject"],
) => `Nuevo mensaje de contacto — ${CONTACT_SUBJECT_LABELS[subject]}`;

export const contactNotificationHtml = (
  request: ContactRequest,
) => `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px 12px;background:#fff6e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fffdf7;border:1px solid ${RULE};border-radius:10px">
    <tr>
      <td style="padding:28px 28px 20px;border-bottom:3px solid ${PLUM}">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Flormorado Café — Formulario de contacto</div>
        <h1 style="margin:8px 0 0;color:${PLUM};font-size:22px;line-height:1.2">${escape(CONTACT_SUBJECT_LABELS[request.subject])}</h1>
      </td>
    </tr>

    <tr>
      <td style="padding:22px 28px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${row("Nombre", escape(request.name))}
          ${row("Correo", `<a href="mailto:${escape(request.email)}" style="color:${INK}">${escape(request.email)}</a>`)}
          ${request.phone ? row("Teléfono", `<a href="tel:${escape(request.phone)}" style="color:${INK}">${escape(request.phone)}</a>`) : ""}
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:22px 28px 28px">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:6px">Mensaje</div>
        <p style="margin:0;color:${INK};font-size:15px;line-height:1.6;white-space:pre-wrap">${escape(request.message)}</p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 28px 28px;border-top:1px solid ${RULE}">
        <p style="margin:16px 0 0;color:${MUTED};font-size:13px;line-height:1.5">
          Responde directamente a este correo: llega a ${escape(request.email)}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
