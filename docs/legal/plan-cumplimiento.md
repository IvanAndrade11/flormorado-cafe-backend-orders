# Plan de cumplimiento legal (FMC-0028)

Al publicar la Política de Tratamiento de Datos Personales (`FMC-0027`) revisamos qué
faltaba para quedar en regla. Salieron cuatro riesgos. Este documento deja por escrito
cuáles son, en qué orden se atacan y **por qué se decidió cada cosa**, que es lo que no
se deduce del código.

El seguimiento del avance vive en el [plan de trabajo](https://claude.ai/artifact/MsUsnwAystaxbEacBtdvfK),
fase 9. Aquí está el razonamiento; allá, las casillas.

## Los cuatro riesgos

| #   | Riesgo                                                                     | Dónde se resuelve   |
| --- | -------------------------------------------------------------------------- | ------------------- |
| 1   | No se guarda prueba de la autorización general del tratamiento             | `FMC-0028`, parte A |
| 2   | No hay forma de suprimir los datos de quien lo pida                        | `FMC-0028`, parte B |
| 3   | Los términos y condiciones siguen siendo texto de ejemplo                  | `FMC-0029`          |
| 4   | Faltan los acuerdos con los proveedores y un procedimiento ante incidentes | `FMC-0028`, parte C |

**El orden no es arbitrario: el punto 1 va primero porque es el único irreversible.**
Cada pedido que entra sin dejar rastro de la autorización es una prueba que después ya
no se puede recuperar. Los otros tres se pueden resolver el día que hagan falta sin
haber perdido nada por el camino.

## Parte A — Prueba de la autorización general

El consentimiento de novedades por WhatsApp ya se prueba bien: cada pedido guarda si la
casilla estaba marcada y qué versión del texto vio el cliente. Del tratamiento general
solo se muestra el enlace a la política, sin dejar rastro. Si alguien dijera «yo nunca
autoricé nada», hoy no tendríamos con qué responder.

Se replica el patrón que ya funciona: `privacy_policy_version` en `orders` y en
`contact_messages`, alimentado desde `DATA_POLICY.version` del frontend.

Dos decisiones que conviene no revisar a ciegas más adelante:

- **La aceptación sigue siendo implícita.** El cliente ve el aviso con el enlace y al
  pulsar «Realizar pedido» acepta. El Decreto 1377 de 2013 (art. 7) admite la conducta
  inequívoca del titular como autorización válida, así que una casilla obligatoria
  añadiría fricción y un motivo más de error en el checkout sin cambiar el fondo.
- **El campo es opcional y algunas filas quedarán vacías, a propósito.** El 11 de
  noviembre de 2026 se vació la base de producción, que solo tenía pedidos de prueba,
  así que no hay historial que arrastre. Pero el backend se publica solo al mezclar y
  la tienda a mano: los pedidos que entren en ese intervalo llegarán sin versión. Eso
  se deja como está. Rellenarlos después sería fabricar una prueba que no tenemos.

**Guardar el número de versión solo prueba algo si el texto de esa versión se puede
recuperar.** El archivo es el historial de git, y eso depende de que
`DATA_POLICY.version` suba con cualquier cambio de fondo de la política. Está escrito
en el `CLAUDE.md` del frontend y ahora importa de verdad, porque hay filas apuntando a
la versión «1.0».

## Parte B — Supresión de datos

La ley obliga a resolver una solicitud de supresión en quince días hábiles. Hoy eso
implicaría correr SQL a mano.

El diseño sale de dos restricciones, no de una preferencia:

- `orders.customer_id` referencia a `customers`, todas las columnas personales de
  `customers` son `NOT NULL` y `phone` es además `UNIQUE`. Borrar la fila dejaría
  pedidos apuntando al vacío, y poner esos campos en `NULL` exigiría reconstruir la
  tabla, que no sería una migración aditiva.
- Los pedidos son soporte contable. La ley permite negar la supresión cuando existe un
  deber legal de conservar, y las normas comerciales y tributarias lo imponen.

Por eso: **se anonimiza la ficha del cliente en su sitio y los pedidos no se tocan.**
Se borran también sus mensajes de contacto, donde no hay deber de conservación, y queda
registrado en `suppressed_at` que la solicitud se atendió — que es lo que hay que poder
demostrar, sin conservar el dato suprimido.

Un efecto secundario que conviene entender antes de que sorprenda: como la supresión
cambia el `phone`, que es la llave del cliente, si esa persona vuelve a comprar el
upsert crea una ficha nueva. Es lo correcto: compra nueva, autorización nueva.

El texto de confirmación del panel tiene que decir sin rodeos qué se borra, qué se
conserva y por qué. Al negocio le van a preguntar si borró todo, y la respuesta tiene
que ser exacta.

## Parte C — Proveedores e incidentes

Dos documentos cortos, en esta misma carpeta:

- `encargados.md`: qué trata cada proveedor (Cloudflare, Resend, GitHub Pages, Zoho),
  dónde aloja los datos y el enlace a su acuerdo de tratamiento. Es el respaldo de que
  procesan por cuenta nuestra, que es lo que sustenta la transferencia internacional.
  Aceptarlos y archivarlos es tarea de Iván; el documento anota cuáles están y cuáles
  faltan.
- `incidentes.md`: qué cuenta como incidente, quién decide, el reporte a la
  Superintendencia de Industria y Comercio que la política promete, y qué se le dice al
  cliente afectado.

## Fuera de este ticket

- **`FMC-0029` — Términos y condiciones.** Es otra norma (Estatuto del Consumidor, Ley
  1480 de 2011, modificada por la Ley 2439 de 2024) y otro tipo de trabajo: deberes de
  información en comercio electrónico, derecho de retracto, reversión del pago y
  garantía legal. Hoy el checkout dice «aceptas nuestros términos» y esos términos
  están vacíos, así que no es un pendiente cosmético.
- **Purgar los pedidos vencido el plazo de conservación.** Ninguno está cerca de
  cumplirlo, pero la política promete que no se guardan para siempre.

## Nada de esto reemplaza una revisión profesional

El contenido se preparó siguiendo la Ley 1581 de 2012, el Decreto 1377 de 2013 y el
Decreto 1074 de 2015, pero no lo redactó un abogado. La revisión profesional de la
política sigue pendiente y es de Iván.
