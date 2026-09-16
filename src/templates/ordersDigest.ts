import { CITY_LABELS, formatCop, PAYMENT_LABELS } from "@/utils/constants";

const PLUM = "#6d2649";
const INK = "#3b2314";
const MUTED = "#8a7566";
const RULE = "#e8e0d0";
const WARN = "#8a6a12";

export interface DigestItem {
  name: string;
  grinding: string;
  quantity: number;
}

export interface DigestOrder {
  id: string;
  createdAt: string;
  customer: string;
  phone: string;
  city: keyof typeof CITY_LABELS;
  neighborhood: string;
  address: string;
  additionalInfo: string | null;
  paymentMethod: keyof typeof PAYMENT_LABELS;
  breKey: string | null;
  total: number;
  pricesVerified: boolean;
  items: DigestItem[];
}

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const hourInColombia = (iso: string) => {
  const local = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const orderBlock = (order: DigestOrder) => `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:18px;border:1px solid ${RULE};border-left:3px solid ${PLUM};border-radius:0 8px 8px 0">
    <tr>
      <td style="padding:14px 16px">
        <div style="color:${PLUM};font-size:16px;font-weight:700">${order.id}</div>
        <div style="color:${MUTED};font-size:13px;margin-top:2px">
          ${hourInColombia(order.createdAt)} &middot; ${escape(order.customer)} &middot; ${escape(order.phone)}
        </div>

        ${
          order.pricesVerified
            ? ""
            : `<div style="margin-top:10px;background:#f2e7c8;border:1px solid ${WARN};border-radius:6px;padding:8px 10px;color:${INK};font-size:13px">
                 <strong>Revisar el precio antes de preparar.</strong> No se pudo consultar el catálogo cuando entró el pedido, así que el total viene del navegador del cliente.
               </div>`
        }

        <div style="margin-top:12px;color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700">Qué empacar</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:4px">
          ${order.items
            .map(
              (item) => `
          <tr>
            <td style="padding:4px 0;color:${INK};font-size:15px">
              <strong>${item.quantity} &times;</strong> ${escape(item.name)}
              <span style="color:${MUTED}"> &middot; ${escape(item.grinding)}</span>
            </td>
          </tr>`,
            )
            .join("")}
        </table>

        <div style="margin-top:12px;color:${MUTED};font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700">A dónde</div>
        <div style="color:${INK};font-size:15px;line-height:1.5;margin-top:2px">
          ${escape(order.address)}<br>
          ${escape(order.neighborhood)}, ${CITY_LABELS[order.city]}
          ${order.additionalInfo ? `<br><span style="color:${MUTED}">${escape(order.additionalInfo)}</span>` : ""}
        </div>

        <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${RULE};color:${INK};font-size:15px">
          ${
            order.paymentMethod === "cash_on_delivery"
              ? `<strong>Cobrar ${formatCop(order.total)}</strong> contraentrega`
              : `<strong>${formatCop(order.total)}</strong> por llave BRE-B ${order.breKey ? `<code style="color:${PLUM}">${escape(order.breKey)}</code>` : ""} — verificar que la transferencia llegó`
          }
        </div>
      </td>
    </tr>
  </table>`;

export const digestSubject = (count: number) =>
  count === 1
    ? "1 pedido nuevo — Flormorado Café"
    : `${count} pedidos nuevos — Flormorado Café`;

export const digestHtml = (orders: DigestOrder[]) => {
  const revenue = orders.reduce((acc, order) => acc + order.total, 0);

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px 12px;background:#fff6e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr>
      <td style="padding:0 0 18px;border-bottom:3px solid ${PLUM}">
        <div style="color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Resumen de pedidos</div>
        <h1 style="margin:6px 0 4px;color:${PLUM};font-size:22px">
          ${orders.length === 1 ? "1 pedido nuevo" : `${orders.length} pedidos nuevos`}
        </h1>
        <div style="color:${INK};font-size:15px">${formatCop(revenue)} en total</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0 0">
        ${orders.map(orderBlock).join("")}
      </td>
    </tr>
    <tr>
      <td style="padding:4px 0 0;border-top:1px solid ${RULE}">
        <p style="margin:14px 0 0;color:${MUTED};font-size:13px;line-height:1.5">
          Este resumen sale cada hora entre 8am y 8pm, y solo cuando hay pedidos nuevos.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
