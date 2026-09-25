-- Migration number: 0007 	 2026-09-25T00:00:00.000Z
-- Alerta de notificaciones fallidas (FMC-0021, fase 8). Un pedido o mensaje cuyo
-- correo no salió queda marcado en `email_status`, pero nadie se entera si no
-- abre el panel. El cron por hora manda un aviso al negocio y usa esta bandera
-- para no repetirlo: solo se marca cuando el aviso salió de verdad, así que si
-- el envío falla se reintenta a la hora siguiente.
--
-- Aditiva: el código anterior ignora la columna.

ALTER TABLE orders ADD COLUMN failure_alerted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contact_messages ADD COLUMN failure_alerted INTEGER NOT NULL DEFAULT 0;

-- Los fallos que ya existen se dan por reportados: son anteriores a esta
-- alerta, el panel los sigue mostrando, y sin esto el primer aviso llegaría
-- con todo el historial de pruebas.
UPDATE orders SET failure_alerted = 1;
UPDATE contact_messages SET failure_alerted = 1;
