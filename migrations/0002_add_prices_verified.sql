-- Migration number: 0002 	 2026-09-15T00:00:00.000Z
-- Si ConfigCat no responde justo cuando entra un pedido, el pedido se acepta
-- igual (nunca se pierde una venta) pero queda marcado para que se revise el
-- precio antes de preparar. El panel resalta estos casos.

ALTER TABLE orders ADD COLUMN prices_verified INTEGER NOT NULL DEFAULT 1;
