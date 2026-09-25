# ☕ Flormorado Café — Backend de Pedidos

> Servicio que recibe los pedidos del checkout de [flormoradocafe.com](https://flormoradocafe.com), los guarda junto con el registro del cliente, le indica cómo pagar y envía las confirmaciones. Desplegado en Cloudflare Workers.

---

## 📋 Tabla de contenido

- [Descripción del proyecto](#-descripción-del-proyecto)
- [Estado actual](#-estado-actual)
- [Tecnologías principales](#️-tecnologías-principales)
- [Arquitectura del proyecto](#️-arquitectura-del-proyecto)
- [Datos y consentimiento](#-datos-y-consentimiento)
- [Seguridad](#-seguridad)
- [Requisitos previos](#-requisitos-previos)
- [Instalación y configuración](#-instalación-y-configuración)
- [Variables de entorno](#-variables-de-entorno)
- [Scripts disponibles](#-scripts-disponibles)
- [Endpoints](#-endpoints)
- [Despliegue](#-despliegue)
- [Licencia](#-licencia)
- [Autor](#-autor)

---

## 🧾 Descripción del proyecto

El checkout del frontend recolectaba toda la información de un pedido (contacto, entrega y método de pago) pero no tenía a dónde enviarla: al confirmar, el pedido no se guardaba ni se notificaba a nadie. Este servicio cierra ese ciclo.

Los dos métodos de pago del negocio —**contraentrega** y **llave BRE-B**— no requieren cobro en línea, así que aquí no hay pasarela de pago. Lo que hace el servicio es:

- **Recibir y validar** el pedido. El total se recalcula con los precios del catálogo de ConfigCat, nunca con los que manda el navegador, y se rechazan productos agotados o carritos con precios viejos.
- **Guardarlo** en D1 antes de intentar cualquier notificación, para que un fallo de correo o WhatsApp nunca signifique un pedido perdido.
- **Registrar al cliente** por su celular, con su consentimiento vigente para recibir novedades.
- **Indicar cómo pagar** por BRE-B: la llave y el titular de la empresa van en la respuesta y en el correo.
- **Notificar** al cliente por correo y al negocio con un resumen cada hora, de 8am a 8pm.
- **Recibir mensajes de contacto** del formulario de la página de contacto, guardarlos y reenviarlos al correo del negocio, con el correo del cliente como `reply-to`.
- **Exponer el panel de control** (`/admin/*`): pedidos, clientes y mensajes de contacto en JSON, protegidos por clave, para que el frontend los muestre en tablas.

---

## 🚦 Estado actual

El plan completo, con el avance por paso, vive en el [plan de trabajo](https://claude.ai/artifact/MsUsnwAystaxbEacBtdvfK).

| Fase | Alcance                                        | Estado                |
| ---- | ---------------------------------------------- | --------------------- |
| 1    | Andamiaje, tooling, CI y documentación         | ✅ Completa           |
| 2    | Núcleo del pedido y base de datos D1           | ✅ Completa           |
| 3    | Correo al cliente y resumen al negocio         | ✅ Falta prueba real  |
| 4    | Panel de control de pedidos (`FMC-0020`)       | ✅ Endpoints listos — la interfaz vive en el frontend |
| 5    | Conexión con el checkout del frontend          | ✅ PR en revisión     |
| 6    | Clientes y pago con BRE-B (`FMC-0017`)         | 🔨 En curso           |
| 7    | Canal de WhatsApp (Meta Cloud API)             | ⏳ Pendiente          |
| 8    | Endurecimiento: límite de tasa, Turnstile y alertas (`FMC-0021`) | 🔨 En curso |

Fuera del plan por fases: el endpoint `POST /contact` (`FMC-0019`), que guarda y reenvía los mensajes del formulario de contacto del frontend al correo del negocio. ✅ Completo.

---

## 🛠️ Tecnologías principales

| Categoría          | Tecnología                                                     |
| ------------------ | -------------------------------------------------------------- |
| **Runtime**        | Cloudflare Workers                                             |
| **Framework HTTP** | Hono 4                                                         |
| **Lenguaje**       | TypeScript 5 (strict)                                          |
| **Validación**     | Zod 4                                                          |
| **Base de datos**  | Cloudflare D1 (SQLite), con migraciones versionadas            |
| **Catálogo**       | Flag `storeProducts` de ConfigCat, validado en ejecución       |
| **Correo**         | Resend                                                         |
| **WhatsApp**       | Meta WhatsApp Cloud API — fase 7                               |
| **Formateo**       | Prettier                                                       |
| **Linter**         | ESLint 10 (flat config) + typescript-eslint                    |
| **Testing**        | Vitest                                                         |
| **CI/CD**          | GitHub Actions: 5 checks en cada PR y despliegue al mezclar a `main` |

---

## 🏗️ Arquitectura del proyecto

Servicio HTTP en capas separadas por responsabilidad, siguiendo la misma organización del frontend (barriles `index.ts`, tipos aparte, constantes en `utils`).

```
src/
├── index.ts          → app de Hono, CORS y cron del resumen
├── middleware/        → adminAuth (clave del panel) y rateLimit (límite por IP)
├── routes/            → health, orders, contact, webhooks/whatsapp, admin*
├── schemas/           → validación Zod del pedido, el contacto, el catálogo y el panel
├── services/          → orders (D1), customers, contactMessages, configcat, payments, resend, whatsapp, digest, alerts, turnstile
├── templates/         → correo al cliente, aviso de contacto y resumen al negocio
├── types/             → bindings del Worker
└── utils/constants/   → ciudades, estados, reglas de precio
migrations/            → esquema de D1, una migración por cambio
docs/configCat/        → estructura real del flag storeProducts
```

**Orden de las operaciones de un pedido:** validar → recalcular el total con el catálogo → guardar cliente, pedido y líneas en un solo lote → responder → notificar en segundo plano.

**Alias de rutas:** `@/*` → `src/*`, declarado en `tsconfig.json` y en `vitest.config.mts`. Si se cambia, hay que actualizar los dos.

---

## 🔏 Datos y consentimiento

La tabla `customers` guarda datos personales con fines comerciales, así que aplica la **Ley 1581 de 2012**: el consentimiento debe ser previo, expreso e informado, y hay que poder probarlo.

- **Identidad:** el celular, que es la llave con la que WhatsApp reconoce a una persona. Cada pedido actualiza los datos del cliente con los más recientes.
- **Consentimiento vigente:** lo define el último pedido. Si el cliente vuelve a comprar sin marcar la casilla de novedades, deja de recibirlas. `marketing_updated_at` solo se mueve cuando ese valor cambia.
- **Prueba:** cada pedido guarda si el cliente marcó la casilla (`whatsapp_opt_in`) y qué versión del texto vio (`marketing_consent_version`).
- **Lo derivable no se guarda:** número de pedidos, total comprado y fechas de compra se calculan desde `orders`.

---

## 🛡️ Seguridad

El endpoint queda expuesto en internet, así que esta capa evita que alguien lo use para mandar correos a nombre de Flormorado, llenar la base de datos de pedidos falsos o agotar las cuotas gratuitas.

| Amenaza | Defensa |
| ------- | ------- |
| Bots que crean pedidos o mensajes en serie | **Turnstile** (captcha de Cloudflare, gratis) en `/orders` y `/contact`; el servidor verifica el token con `siteverify` |
| Ráfagas desde una misma IP | **Límite de tasa** por IP: 10 pedidos, 5 mensajes de contacto y 30 llamadas al panel por minuto |
| Usar el checkout para llenar de correos el buzón de un tercero | Límite de 3 pedidos por minuto **por correo del cliente**, además del de IP |
| Adivinar la clave del panel a fuerza bruta | Límite por IP antes de verificar la clave, y comparación en tiempo constante que tampoco filtra el largo |
| Cuerpos gigantes | Tope de 32 KB antes de leer el JSON |
| Datos personales en cachés | `Cache-Control: no-store` en `/admin/*` |
| Respuestas interpretadas por el navegador | Encabezados de `secureHeaders` de Hono (`nosniff`, `Referrer-Policy`, …) y errores en JSON sin detalles internos |
| Fallos de notificación que nadie ve | Aviso al negocio por correo (ver abajo) y marca en el panel |

**Turnstile es opcional por configuración.** Sin `TURNSTILE_SECRET_KEY` no se exige el token, y así el backend puede publicarse antes que el frontend (que se despliega a mano) sin rechazar los pedidos de la tienda que todavía no lo manda. Con el secreto puesto: token ausente, vencido o reutilizado responde `403`; si Cloudflare no responde o el secreto está mal configurado, se deja pasar y se registra el error (perder una venta es peor que un rato sin verificar). Un token vale una sola vez, pero el frontend reintenta con el mismo cuando falla la red, así que la verificación se hace con la llave de idempotencia del pedido: Cloudflare devuelve el resultado original en vez de "token ya usado".

**Los límites de tasa son una capa contra el abuso, no contabilidad exacta.** Cloudflare los cuenta por ubicación y de forma eventualmente consistente, y el código falla abierto si el binding falta o no responde. Las cifras son generosas porque muchos clientes comparten IP (datos móviles, oficinas). Van definidas en `wrangler.toml`; `period` solo admite 10 o 60 segundos.

**Alerta de notificaciones fallidas.** El cron de cada hora, además del resumen de pedidos, revisa pedidos y mensajes cuyo correo (o WhatsApp) falló, o que llevan más de 30 minutos en `pendiente` —el envío corre en segundo plano y un Worker cortado deja el estado sin actualizar—, y manda **un solo correo** al negocio con la lista. `failure_alerted` (migración `0007`) evita repetir el aviso y solo se marca cuando el correo salió: si el fallo es de Resend, el aviso se reintenta la hora siguiente. Las filas anteriores a la migración se dan por avisadas. En el panel, la lista de pedidos y la de mensajes marcan esos casos con «Notificación fallida».

---

## 📋 Requisitos previos

- **Node.js** 22 o superior
- **npm** 10 o superior
- Una cuenta de [Cloudflare](https://dash.cloudflare.com) (plan Free)

---

## ⚙️ Instalación y configuración

```bash
npm install
npx wrangler login
npx wrangler d1 migrations apply flormorado-orders --local
npm start
```

Queda escuchando en `http://localhost:8787`. Para probarlo junto con el frontend en local, `.dev.vars` debe incluir `ALLOWED_ORIGINS=http://localhost:3000`.

---

## 🔐 Variables de entorno

Los **secretos** viven en el almacén de Cloudflare y se cargan con `npx wrangler secret put NOMBRE`. Las **variables** van en `wrangler.toml` a propósito: son públicas, y tenerlas en git deja rastro de cada cambio. Para desarrollo local, los secretos van en `.dev.vars` (ignorado por git).

| Nombre                     | Tipo     | Descripción                                             |
| -------------------------- | -------- | ------------------------------------------------------- |
| `DB`                       | Binding  | Base D1 `flormorado-orders`                             |
| `CONFIGCAT_SDK_KEY`        | Secreto  | SDK key de ConfigCat, para leer el catálogo             |
| `RESEND_API_KEY`           | Secreto  | API key de Resend                                       |
| `ORDERS_EMAIL_TO`          | Secreto  | Buzón de la empresa que recibe el resumen y los mensajes de `/contact` |
| `ORDERS_EMAIL_FROM`        | Variable | Remitente verificado (`info@flormoradocafe.com`)     |
| `ALLOWED_ORIGINS`          | Variable | Orígenes autorizados por CORS, separados por coma       |
| `BREB_KEY`                 | Variable | Llave BRE-B de la empresa                               |
| `BREB_HOLDER`              | Variable | Titular que el cliente verá al confirmar la transferencia |
| `ADMIN_PASSWORD`           | Secreto  | Clave del panel de pedidos — fase 4                     |
| `WHATSAPP_VERIFY_TOKEN`    | Secreto  | Cadena que inventamos; Meta la usa para verificar el webhook |
| `WHATSAPP_APP_SECRET`      | Secreto  | Secreto de la app de Meta, valida la firma de cada webhook |
| `WHATSAPP_TOKEN`           | Secreto  | Token permanente de Meta — fase 7                       |
| `WHATSAPP_PHONE_NUMBER_ID` | Secreto  | ID del número en la Cloud API — fase 7                  |
| `TURNSTILE_SECRET_KEY`     | Secreto  | Secreto del widget de Turnstile — fase 8. Opcional: sin él no se exige el token |
| `ORDER_IP_LIMITER`, `ORDER_EMAIL_LIMITER`, `CONTACT_IP_LIMITER`, `ADMIN_IP_LIMITER` | Binding | Limitadores de tasa de `wrangler.toml` (`[[ratelimits]]`) — fase 8 |

---

## 📜 Scripts disponibles

| Script                   | Descripción                                          |
| ------------------------ | ---------------------------------------------------- |
| `npm start`              | Servidor de desarrollo local con recarga             |
| `npm run build`          | Compila el bundle sin desplegar (lo que corre el CI) |
| `npm run deploy`         | Despliega el Worker a Cloudflare                     |
| `npm run lint`           | ESLint sobre `src/**/*.ts`                           |
| `npm run lint:fix`       | ESLint con `--fix`                                   |
| `npm run prettier`       | Formatea el código                                   |
| `npm run prettier:check` | Verifica el formato sin escribir                     |
| `npm test`               | Corre la suite de pruebas una vez                    |
| `npm run test:watch`     | Pruebas en modo watch                                |
| `npx tsc --noEmit`       | Verificación de tipos sin emitir archivos            |

Para correr un solo archivo de pruebas: `npx vitest run src/services/orders.test.ts`

---

## 🔌 Endpoints

| Método | Ruta      | Descripción                                                     |
| ------ | --------- | --------------------------------------------------------------- |
| `GET`  | `/health` | Verifica que el servicio está arriba. Abierto a cualquier origen |
| `POST` | `/orders` | Crea un pedido. Solo acepta llamadas desde los orígenes autorizados |
| `POST` | `/contact` | Guarda y reenvía un mensaje del formulario de contacto al correo del negocio. Solo acepta llamadas desde los orígenes autorizados |
| `GET`  | `/webhooks/whatsapp` | Verificación del webhook: responde el `hub.challenge` de Meta |
| `POST` | `/webhooks/whatsapp` | Recibe eventos de Meta. Solo acepta payloads con firma HMAC válida |
| `GET`  | `/admin/orders` | Lista pedidos (`limit`, `offset`, `status` y `q`, que busca por número de pedido, documento, celular, correo o nombre completo). Requiere `Authorization: Bearer <ADMIN_PASSWORD>` |
| `GET`  | `/admin/orders/:id` | Detalle de un pedido: productos, historial de estado y notificaciones |
| `PATCH` | `/admin/orders/:id/status` | Cambia el estado del pedido, validando la transición según el método de pago |
| `GET`  | `/admin/customers` | Lista clientes con pedidos y total comprado calculados desde `orders` (`limit`, `offset`, `marketing` = `1` autorizadas o `0` de baja, y `q`, que busca por nombre completo, celular, correo o documento) |
| `GET`  | `/admin/customers/:id` | Detalle de un cliente: sus datos y su historial de pedidos con lo que respondió en la casilla de novedades (prueba del consentimiento) |
| `PATCH` | `/admin/customers/:id/opt-out` | Da de baja las novedades por WhatsApp de un cliente (Ley 1581) |
| `GET`  | `/admin/contact-messages` | Lista los mensajes del formulario de contacto |
| `PATCH` | `/admin/contact-messages/:id/status` | Marca un mensaje como `atendido` o `nuevo` |

`POST /orders` y `POST /contact` aceptan el encabezado opcional `X-Turnstile-Token` con el token del widget de Turnstile; se exige solo cuando existe `TURNSTILE_SECRET_KEY`. Ver [Seguridad](#-seguridad).

Respuestas de `POST /orders`:

| Código | Cuándo                                                                                   |
| ------ | ---------------------------------------------------------------------------------------- |
| `201`  | Pedido creado. Incluye `orderId`, `total` y, si paga por BRE-B, `instruccionesPago`      |
| `200`  | La llave de idempotencia ya creó un pedido: se devuelve ese mismo, con `yaExistia: true` |
| `400`  | Datos inválidos, con el detalle por campo                                                |
| `403`  | Turnstile rechazó el token (o no llegó y es obligatorio): `verificacion_fallida`         |
| `409`  | Carrito desactualizado: producto agotado, inexistente o con precio distinto              |
| `413`  | El cuerpo pesa más de 32 KB                                                              |
| `429`  | Demasiadas peticiones desde la misma IP o para el mismo correo. Lleva `Retry-After: 60`  |

Respuestas de `POST /contact`:

| Código | Cuándo |
| ------ | ------ |
| `201`  | Mensaje guardado y reenviado al correo del negocio (`ORDERS_EMAIL_TO`), con el correo del cliente como `reply-to` |
| `400`  | Datos inválidos, con el detalle por campo |
| `403`  | Turnstile rechazó el token (o no llegó y es obligatorio) |
| `413` / `429` | Cuerpo de más de 32 KB / demasiadas peticiones desde la misma IP |
| `502`  | El mensaje ya quedó guardado, pero Resend no pudo enviarlo: se devuelve un error para que el frontend reintente. Un reintento con el mismo correo y texto reutiliza el mensaje guardado en vez de duplicarlo |

Respuestas de `/admin/*`:

| Código | Cuándo |
| ------ | ------ |
| `401`  | Falta el header `Authorization: Bearer <clave>` o la clave no coincide con `ADMIN_PASSWORD` |
| `429`  | Más de 30 peticiones por minuto desde la misma IP, antes de verificar la clave |
| `404`  | El pedido, cliente o mensaje no existe |
| `409`  | `PATCH .../orders/:id/status` con una transición que no aplica al estado o método de pago actuales; la respuesta incluye `permitidos` con los estados válidos |

---

## 🚀 Despliegue

El CI despliega solo: cada push a `main` corre los 5 checks y, si pasan, **aplica las migraciones pendientes de D1 y después publica el Worker**. Se hace desde GitHub Actions porque la red corporativa de la máquina de desarrollo bloquea la subida a Cloudflare.

- Si las migraciones fallan, el Worker no se publica y producción sigue con el código anterior.
- El token `CLOUDFLARE_API_TOKEN` necesita permiso de **D1: Edit** además de los de Workers.
- Cada migración debe ser **aditiva** (tablas nuevas, columnas que aceptan nulo): entre la migración y el deploy hay unos segundos en los que el código anterior corre contra el esquema nuevo.

---

## 📄 Licencia

ISC

---

## 👤 Autor

**Iván Andrade** — Colombia
