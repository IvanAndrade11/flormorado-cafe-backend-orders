import { Hono } from "hono";

import { orderRequestSchema } from "@/schemas/order";
import {
  CatalogShapeError,
  CatalogUnavailableError,
  fetchCatalog,
} from "@/services/configcat";
import {
  buildOrderId,
  findByIdempotencyKey,
  persistOrder,
  priceFromClient,
  priceOrder,
  recordEmailStatus,
  type PricedOrder,
} from "@/services/orders";
import { sendEmail } from "@/services/resend";
import {
  confirmationHtml,
  confirmationSubject,
} from "@/templates/orderConfirmation";
import type { Env } from "@/types/env";

export const orders = new Hono<{ Bindings: Env }>();

const isUniqueViolation = (error: unknown) =>
  error instanceof Error && /UNIQUE constraint failed/i.test(error.message);

orders.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null) {
    return c.json({ error: "json_invalido" }, 400);
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "datos_invalidos",
        campos: parsed.error.issues.map((i) => ({
          campo: i.path.join("."),
          mensaje: i.message,
        })),
      },
      400,
    );
  }

  const request = parsed.data;

  // Si el navegador reintenta por un fallo de red, devolvemos el pedido que ya
  // se creó en lugar de crear uno nuevo.
  const existing = await findByIdempotencyKey(c.env, request.idempotencyKey);
  if (existing) {
    return c.json({
      orderId: existing.id,
      total: existing.total,
      preciosVerificados: existing.prices_verified === 1,
      yaExistia: true,
    });
  }

  let priced: PricedOrder;
  let pricesVerified = true;

  try {
    const catalog = await fetchCatalog(c.env.CONFIGCAT_SDK_KEY);
    const result = priceOrder(request, catalog);

    if ("failures" in result) {
      // El carrito se guarda 14 días, así que lo más probable es que los
      // precios hayan cambiado desde que lo armó. El frontend debe pedirle que
      // lo revise en vez de cobrarle un monto que no aceptó.
      return c.json(
        { error: "carrito_desactualizado", fallas: result.failures },
        409,
      );
    }

    priced = result;
  } catch (error) {
    if (
      error instanceof CatalogUnavailableError ||
      error instanceof CatalogShapeError
    ) {
      priced = priceFromClient(request);
      pricesVerified = false;
    } else {
      throw error;
    }
  }

  const now = new Date();

  for (let attempt = 0; attempt < 2; attempt++) {
    const orderId = await buildOrderId(c.env.DB, now);

    try {
      await persistOrder(c.env, {
        orderId,
        request,
        priced,
        pricesVerified,
        now,
      });

      // El correo sale en segundo plano: el pedido ya está guardado, así que
      // hacer esperar al cliente por Resend solo aumentaría la probabilidad de
      // que cierre la pestaña antes de ver su confirmación.
      c.executionCtx.waitUntil(
        (async () => {
          const sent = await sendEmail({
            apiKey: c.env.RESEND_API_KEY,
            from: c.env.ORDERS_EMAIL_FROM,
            to: request.contact.email,
            subject: confirmationSubject(orderId),
            html: confirmationHtml({
              orderId,
              request,
              lines: priced.lines,
              totals: priced.totals,
            }),
          });

          await recordEmailStatus(
            c.env,
            orderId,
            sent.ok ? "enviado" : `fallo: ${sent.error}`,
          );
        })(),
      );

      return c.json(
        {
          orderId,
          total: priced.totals.total,
          preciosVerificados: pricesVerified,
        },
        201,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // O dos pedidos simultáneos pelearon por el mismo número consecutivo
      // —reintentamos— o el navegador mandó dos veces la misma llave y ganó la
      // otra petición, en cuyo caso devolvemos ese pedido.
      const raced = await findByIdempotencyKey(c.env, request.idempotencyKey);
      if (raced) {
        return c.json({
          orderId: raced.id,
          total: raced.total,
          preciosVerificados: raced.prices_verified === 1,
          yaExistia: true,
        });
      }
    }
  }

  return c.json({ error: "no_se_pudo_registrar" }, 503);
});
