-- Migration number: 0008 	 2026-11-11T00:00:00.000Z
-- Prueba de la autorización general del tratamiento (FMC-0028, fase 9).
--
-- Del consentimiento de novedades ya se guarda la respuesta del cliente y la
-- versión del texto que vio. Del tratamiento general solo se le mostraba el
-- enlace a la política, sin dejar rastro: si alguien reclamara que nunca
-- autorizó nada, no habría con qué responderle. La Ley 1581 exige que la
-- autorización pueda consultarse después, así que hay que guardarla.
--
-- Guardar el número de versión solo prueba algo si el texto de esa versión se
-- puede recuperar. El archivo es el historial de git, y eso depende de que
-- `DATA_POLICY.version` del frontend suba con cualquier cambio de fondo de la
-- política. Si alguien edita el texto sin subir la versión, estas filas pasan a
-- apuntar a una redacción que el cliente nunca vio.
--
-- Aditiva y sin DEFAULT. Queda en NULL cuando el pedido entra desde una tienda
-- que todavía no manda el campo, que es lo que pasa entre que se publica el
-- backend —sale solo al mezclar— y la tienda, que se publica a mano. Esas filas
-- se dejan vacías: rellenarlas después sería fabricar una prueba que no existe.

ALTER TABLE orders ADD COLUMN privacy_policy_version TEXT;
ALTER TABLE contact_messages ADD COLUMN privacy_policy_version TEXT;
