-- Migration number: 0003 	 2026-09-15T00:00:00.000Z
-- El resumen al negocio sale cada hora solo si hay pedidos que no se hayan
-- reportado todavía. Esta bandera es la que distingue "nuevo para el negocio"
-- de "nuevo" como estado del pedido: un pedido ya reportado puede seguir en
-- estado 'nuevo' porque nadie lo ha empezado a preparar.

ALTER TABLE orders ADD COLUMN digest_sent INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_orders_digest_pending ON orders (digest_sent) WHERE digest_sent = 0;
