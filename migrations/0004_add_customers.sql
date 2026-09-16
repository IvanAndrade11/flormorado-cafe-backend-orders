-- Migration number: 0004 	 2026-09-16T00:00:00.000Z
-- Registro de clientes para hacerles seguimiento y, a quien lo autorizó,
-- mandarle novedades por WhatsApp.
--
-- La identidad es el celular porque es la llave con la que WhatsApp reconoce a
-- una persona. Se guarda en el formato que valida el checkout (10 dígitos que
-- empiezan en 3); el envío por WhatsApp le antepone el 57.
--
-- Nada que se pueda calcular desde `orders` se guarda aquí (número de pedidos,
-- total comprado, primera y última compra), para que nunca se desactualice.

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,

  -- Datos del último pedido: si el cliente cambia de correo o de dirección,
  -- manda lo más reciente.
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  city TEXT NOT NULL,

  -- Consentimiento vigente para novedades por WhatsApp (Ley 1581 de 2012). Lo
  -- define el último pedido: si el cliente vuelve a comprar sin marcar la
  -- casilla, queda en 0. La prueba de cada respuesta está en `orders`.
  whatsapp_marketing INTEGER NOT NULL DEFAULT 0,
  -- Cuándo cambió por última vez ese consentimiento, no cuándo se tocó la fila.
  marketing_updated_at TEXT NOT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  CHECK (whatsapp_marketing IN (0, 1))
);

-- Para armar la lista de envío de novedades sin recorrer toda la tabla.
CREATE INDEX idx_customers_marketing ON customers (whatsapp_marketing)
  WHERE whatsapp_marketing = 1;

ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers (id);

-- Versión del texto de la casilla de novedades que vio el cliente. Junto con
-- `whatsapp_opt_in` y `created_at` es la prueba de qué aceptó y cuándo.
ALTER TABLE orders ADD COLUMN marketing_consent_version TEXT;

CREATE INDEX idx_orders_customer_id ON orders (customer_id);
