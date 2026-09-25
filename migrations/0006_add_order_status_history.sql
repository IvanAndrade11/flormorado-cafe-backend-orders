-- Migration number: 0006 	 2026-09-18T00:00:00.000Z
-- Rastro de cambios de estado de un pedido, para que el panel muestre cuándo
-- pasó de uno a otro (fase 4, f4-status). El estado vigente sigue viviendo en
-- orders.status; esta tabla es solo el historial, nunca la fuente de verdad.

CREATE TABLE order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history (order_id);
