const PLUM = "#6d2649";
const INK = "#3b2314";
const MUTED = "#8a7566";
const RULE = "#e8e0d0";
const WARN = "#8a6a12";

export interface FailedOrder {
  id: string;
  createdAt: string;
  customer: string;
  phone: string;
  // Qué canal falló y con qué texto: es lo que sirve para diagnosticar.
  failures: string[];
}

export interface FailedContactMessage {
  id: number;
  createdAt: string;
  name: string;
  email: string;
  failure: string;
}

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const timeInColombia = (iso: string) => {
  const local = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
};

export const failureAlertSubject = (count: number) =>
  count === 1
    ? "⚠ 1 notificación no salió — Flormorado Café"
    : `⚠ ${count} notificaciones no salieron — Flormorado Café`;

const orderBlock = (order: FailedOrder) => `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;border:1px solid ${RULE};border-left:3px solid ${WARN};border-radius:0 8px 8px 0">
    <tr>
      <td style="padding:12px 16px">
        <div style="color:${PLUM};font-size:16px;font-weight:700">${escape(order.id)}</div>
        <div style="color:${MUTED};font-size:13px;margin-top:2px">
          ${timeInColombia(order.createdAt)} &middot; ${escape(order.customer)} &middot; ${escape(order.phone)}
        </div>
        ${order.failures
          .map(
            (failure) =>
              `<div style="margin-top:8px;color:${INK};font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace">${escape(failure)}</div>`,
          )
          .join("")}
      </td>
    </tr>
  </table>`;

const messageBlock = (message: FailedContactMessage) => `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;border:1px solid ${RULE};border-left:3px solid ${WARN};border-radius:0 8px 8px 0">
    <tr>
      <td style="padding:12px 16px">
        <div style="color:${PLUM};font-size:16px;font-weight:700">Mensaje de ${escape(message.name)}</div>
        <div style="color:${MUTED};font-size:13px;margin-top:2px">
          ${timeInColombia(message.createdAt)} &middot; ${escape(message.email)}
        </div>
        <div style="margin-top:8px;color:${INK};font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace">${escape(message.failure)}</div>
      </td>
    </tr>
  </table>`;

export const failureAlertHtml = (
  orders: FailedOrder[],
  messages: FailedContactMessage[],
) => `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px 12px;background:#fff6e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr>
      <td style="padding:0 0 18px;border-bottom:3px solid ${WARN}">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Alerta de notificaciones</div>
        <h1 style="margin:6px 0 4px;color:${PLUM};font-size:22px">Algo no salió como debía</h1>
        <div style="color:${INK};font-size:15px;line-height:1.5">
          Los pedidos y mensajes de abajo <strong>sí quedaron guardados</strong>, pero una notificación no llegó a destino.
        </div>
      </td>
    </tr>
    ${
      orders.length > 0
        ? `<tr>
      <td style="padding:20px 0 0">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:8px">Pedidos — escríbele al cliente por WhatsApp para confirmar</div>
        ${orders.map(orderBlock).join("")}
      </td>
    </tr>`
        : ""
    }
    ${
      messages.length > 0
        ? `<tr>
      <td style="padding:20px 0 0">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:8px">Mensajes de contacto — revísalos en el panel</div>
        ${messages.map(messageBlock).join("")}
      </td>
    </tr>`
        : ""
    }
    <tr>
      <td style="padding:4px 0 0;border-top:1px solid ${RULE}">
        <p style="margin:14px 0 0;color:${MUTED};font-size:13px;line-height:1.5">
          Cada caso se avisa una sola vez. Puedes ver el detalle de cada notificación en el panel, en <code>/#/panel</code>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
