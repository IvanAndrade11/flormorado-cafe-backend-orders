import type { OrderRequest } from "@/schemas/order";
import type { BreBInstructions } from "@/services/payments";
import {
  CITY_LABELS,
  formatCop,
  type PricedLine,
  type Totals,
} from "@/utils/constants";

// Los correos se ven en decenas de clientes distintos, así que van con estilos
// en línea y sin hoja de estilos externa: Gmail y Outlook descartan <style>.
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

const itemRow = (line: PricedLine) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid ${RULE};color:${INK};font-size:15px">
      ${escape(line.name ?? line.productId)}
      <div style="color:${MUTED};font-size:13px;margin-top:2px">
        Molienda: ${escape(line.grinding)}${line.size ? ` &middot; ${escape(line.size)} g` : ""}
      </div>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid ${RULE};color:${MUTED};font-size:15px;text-align:center;white-space:nowrap">
      &times;&nbsp;${line.quantity}
    </td>
    <td style="padding:10px 0;border-bottom:1px solid ${RULE};color:${INK};font-size:15px;text-align:right;white-space:nowrap">
      ${formatCop(line.unitPrice * line.quantity)}
    </td>
  </tr>`;

const totalRow = (label: string, value: string, strong = false) => `
  <tr>
    <td colspan="2" style="padding:6px 0;color:${strong ? INK : MUTED};font-size:${strong ? "17px" : "15px"};${strong ? "font-weight:700" : ""}">
      ${label}
    </td>
    <td style="padding:6px 0;text-align:right;white-space:nowrap;color:${strong ? PLUM : INK};font-size:${strong ? "19px" : "15px"};${strong ? "font-weight:700" : ""}">
      ${value}
    </td>
  </tr>`;

/** Qué sigue después de confirmar, que depende del método de pago. */
const nextSteps = (
  request: OrderRequest,
  total: number,
  orderId: string,
  instructions?: BreBInstructions,
) => {
  if (request.payment.method === "cash_on_delivery") {
    return `Pagas al momento de recibir tu pedido. Ten listos <strong>${formatCop(total)}</strong> en efectivo.`;
  }

  if (!instructions) {
    return `Te contactaremos para completar el pago, y empezamos a preparar tu pedido en cuanto lo confirmemos.`;
  }

  // El nombre y el número de pedido no son adorno: el primero es la defensa del
  // cliente contra una llave suplantada, el segundo es lo que nos permite saber
  // a qué pedido corresponde cada transferencia.
  return `Transfiere <strong>${formatCop(total)}</strong> a la llave BRE-B <strong>${escape(instructions.llave)}</strong>.<br><br>
    Antes de confirmar, tu banco te mostrará el nombre del receptor: verifica que corresponda a <strong>${escape(instructions.titular)}</strong>.<br><br>
    En el mensaje de la transferencia escribe tu número de pedido, <strong>${orderId}</strong>. Empezamos a preparar tu pedido en cuanto confirmemos el pago.`;
};

export interface ConfirmationArgs {
  orderId: string;
  request: OrderRequest;
  lines: PricedLine[];
  totals: Totals;
  paymentInstructions?: BreBInstructions;
}

export const confirmationSubject = (orderId: string) =>
  `Pedido ${orderId} confirmado — Flormorado Café`;

export const confirmationHtml = ({
  orderId,
  request,
  lines,
  totals,
  paymentInstructions,
}: ConfirmationArgs) => {
  const { contact, delivery } = request;

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px 12px;background:#fff6e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fffdf7;border:1px solid ${RULE};border-radius:10px">
    <tr>
      <td style="padding:28px 28px 20px;border-bottom:3px solid ${PLUM}">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Flormorado Café</div>
        <h1 style="margin:8px 0 6px;color:${PLUM};font-size:24px;line-height:1.2">¡Gracias por tu pedido, ${escape(contact.name)}!</h1>
        <p style="margin:0;color:${MUTED};font-size:15px">
          Tu pedido es el <strong style="color:${INK}">${orderId}</strong>. Guarda este número para cualquier consulta.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:22px 28px 0">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:6px">Lo que pediste</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${lines.map(itemRow).join("")}
          ${totalRow("Subtotal", formatCop(totals.subtotal))}
          ${totalRow("Envío", totals.shipping === 0 ? "¡Gratis!" : formatCop(totals.shipping))}
          ${totalRow("Total", formatCop(totals.total), true)}
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:22px 28px 0">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:6px">Dónde lo entregamos</div>
        <p style="margin:0;color:${INK};font-size:15px;line-height:1.5">
          ${escape(delivery.address)}<br>
          ${escape(delivery.neighborhood)}, ${CITY_LABELS[delivery.city]}
          ${delivery.additionalInfo ? `<br><span style="color:${MUTED}">${escape(delivery.additionalInfo)}</span>` : ""}
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:22px 28px 28px">
        <div style="background:#f1dee7;border-radius:8px;padding:14px 16px">
          <div style="color:${PLUM};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:4px">Qué sigue</div>
          <p style="margin:0;color:${INK};font-size:15px;line-height:1.5">${nextSteps(request, totals.total, orderId, paymentInstructions)}</p>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:0 28px 28px;border-top:1px solid ${RULE}">
        <p style="margin:16px 0 0;color:${MUTED};font-size:13px;line-height:1.5">
          Entregamos en Bogotá y municipios aledaños. Si algo no cuadra con tu pedido,
          respóndenos a este correo mencionando el número <strong>${orderId}</strong>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
