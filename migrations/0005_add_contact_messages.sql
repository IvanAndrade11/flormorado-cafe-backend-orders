-- Migration number: 0005 	 2026-09-18T00:00:00.000Z
-- Mensajes del formulario de contacto (`POST /contact`, FMC-0019). Hasta ahora
-- el correo a `ORDERS_EMAIL_TO` era el único registro: si Resend fallaba o
-- nadie miraba el correo, el mensaje se perdía sin dejar rastro. Se guarda
-- antes de intentar el envío, igual que un pedido, para que el panel pueda
-- mostrarlo y hacerle seguimiento aunque el correo nunca llegue.

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Rastro del envío a ORDERS_EMAIL_TO, mismo criterio que orders.email_status.
  email_status TEXT NOT NULL DEFAULT 'pendiente',

  -- Seguimiento del negocio, no del envío del correo: si ya se le respondió al
  -- cliente por fuera de este sistema (llamada, WhatsApp).
  status TEXT NOT NULL DEFAULT 'nuevo',

  CHECK (status IN ('nuevo', 'atendido')),
  CHECK (subject IN ('pedido', 'producto', 'mayoristas', 'prensa', 'otro'))
);

CREATE INDEX idx_contact_messages_created_at ON contact_messages (created_at DESC);
CREATE INDEX idx_contact_messages_status ON contact_messages (status);
