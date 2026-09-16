-- Migration number: 0001 	 2026-09-15T00:00:00.000Z
-- Pedidos de Flormorado Café.
-- Los montos se guardan como enteros en pesos colombianos: el COP no usa
-- decimales en la práctica, y enteros evitan los errores de redondeo que
-- tendría un float al sumar precios.

CREATE TABLE orders (
  -- Número legible que el cliente ve y por el que pregunta: FM-20260915-001
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo',

  -- Identifica un intento de compra, no un pedido. Si el navegador reintenta
  -- por un fallo de red, reenvía la misma llave y el UNIQUE impide que se
  -- cree un segundo pedido idéntico.
  idempotency_key TEXT NOT NULL UNIQUE,

  -- Contacto
  customer_name TEXT NOT NULL,
  customer_surname TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 0,
  notify_whatsapp INTEGER NOT NULL DEFAULT 0,

  -- Entrega
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL,
  additional_info TEXT,

  -- Pago. bre_key solo aplica cuando payment_method = 'bre_b'.
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  bre_key TEXT,

  -- Totales calculados en el servidor, nunca tomados del navegador
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,

  -- Rastro de notificaciones: permite ver en el panel qué salió y qué falló,
  -- sin que un fallo de envío bloquee el pedido.
  email_status TEXT NOT NULL DEFAULT 'pendiente',
  whatsapp_status TEXT NOT NULL DEFAULT 'no_aplica',

  CHECK (status IN ('nuevo', 'pago_confirmado', 'en_preparacion', 'por_entregar', 'entregado', 'cancelado')),
  CHECK (payment_method IN ('cash_on_delivery', 'bre_b')),
  CHECK (subtotal >= 0 AND shipping >= 0 AND total >= 0)
);

-- El panel lista por fecha descendente y filtra por estado; este índice cubre
-- ambos accesos.
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX idx_orders_status ON orders (status);

-- Un pedido tiene una cantidad variable de productos, por eso van en su propia
-- tabla en vez de columnas producto1, producto2, ...
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  -- La molienda es la regla de negocio no obvia del carrito: el mismo producto
  -- con moliendas distintas son líneas distintas del pedido.
  grinding TEXT,
  size TEXT,

  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,

  CHECK (quantity > 0),
  CHECK (unit_price >= 0)
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
