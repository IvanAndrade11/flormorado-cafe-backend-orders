-- Migration number: 0010 	 2026-11-11T00:00:00.000Z
-- Versión de los términos y condiciones aceptados (FMC-0029).
--
-- Mismo criterio que `privacy_policy_version` de la 0008, pero por otra norma.
-- Los términos no son habeas data: son el contrato, y sirven sobre todo para lo
-- que el negocio puede exigirle al cliente (plazos, condiciones de devolución).
-- Una cláusula que el cliente nunca aceptó es difícil de hacer valer, así que
-- queda registrado qué versión regía cuando compró.
--
-- Aditiva y sin DEFAULT, por la misma razón que la 0008: entre que se publica
-- el backend y la tienda, los pedidos entran sin el campo. Esas filas se dejan
-- vacías.

ALTER TABLE orders ADD COLUMN terms_version TEXT;
