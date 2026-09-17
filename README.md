# ☕ Flormorado Café — Backend de Pedidos

> Servicio que recibe los pedidos del checkout de [flormoradocafe.com](https://flormoradocafe.com), los guarda junto con el registro del cliente, le indica cómo pagar y envía las confirmaciones. Desplegado en Cloudflare Workers.

---

## 📋 Tabla de contenido

- [Descripción del proyecto](#-descripción-del-proyecto)
- [Estado actual](#-estado-actual)
- [Tecnologías principales](#️-tecnologías-principales)
- [Arquitectura del proyecto](#️-arquitectura-del-proyecto)
- [Datos y consentimiento](#-datos-y-consentimiento)
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

---

## 🚦 Estado actual

El plan completo, con el avance por paso, vive en el [plan de trabajo](https://claude.ai/artifact/MsUsnwAystaxbEacBtdvfK).

| Fase | Alcance                                        | Estado                |
| ---- | ---------------------------------------------- | --------------------- |
| 1    | Andamiaje, tooling, CI y documentación         | ✅ Completa           |
| 2    | Núcleo del pedido y base de datos D1           | ✅ Completa           |
| 3    | Correo al cliente y resumen al negocio         | ✅ Falta prueba real  |
| 4    | Panel de control de pedidos                    | ⏳ Pendiente          |
| 5    | Conexión con el checkout del frontend          | ✅ PR en revisión     |
| 6    | Clientes y pago con BRE-B (`FMC-0017`)         | 🔨 En curso           |
| 7    | Canal de WhatsApp (Meta Cloud API)             | ⏳ Pendiente          |
| 8    | Endurecimiento (rate limit, alertas)           | ⏳ Pendiente          |

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
├── routes/           → health, orders
├── schemas/          → validación Zod del pedido y del catálogo
├── services/         → orders (D1), configcat, payments, resend, digest
├── templates/        → correo al cliente y resumen al negocio
├── types/            → bindings del Worker
└── utils/constants/  → ciudades, estados, reglas de precio
migrations/           → esquema de D1, una migración por cambio
docs/configCat/       → estructura real del flag storeProducts
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
| `ORDERS_EMAIL_TO`          | Secreto  | Buzón de la empresa que recibe el resumen               |
| `ORDERS_EMAIL_FROM`        | Variable | Remitente verificado (`info@flormoradocafe.com`)     |
| `ALLOWED_ORIGINS`          | Variable | Orígenes autorizados por CORS, separados por coma       |
| `BREB_KEY`                 | Variable | Llave BRE-B de la empresa                               |
| `BREB_HOLDER`              | Variable | Titular que el cliente verá al confirmar la transferencia |
| `ADMIN_PASSWORD`           | Secreto  | Clave del panel de pedidos — fase 4                     |
| `WHATSAPP_VERIFY_TOKEN`    | Secreto  | Cadena que inventamos; Meta la usa para verificar el webhook |
| `WHATSAPP_APP_SECRET`      | Secreto  | Secreto de la app de Meta, valida la firma de cada webhook |
| `WHATSAPP_TOKEN`           | Secreto  | Token permanente de Meta — fase 7                       |
| `WHATSAPP_PHONE_NUMBER_ID` | Secreto  | ID del número en la Cloud API — fase 7                  |
| `TURNSTILE_SECRET`         | Secreto  | Secreto del widget de Turnstile — fase 8                |

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
| `GET`  | `/webhooks/whatsapp` | Verificación del webhook: responde el `hub.challenge` de Meta |
| `POST` | `/webhooks/whatsapp` | Recibe eventos de Meta. Solo acepta payloads con firma HMAC válida |

Respuestas de `POST /orders`:

| Código | Cuándo                                                                                   |
| ------ | ---------------------------------------------------------------------------------------- |
| `201`  | Pedido creado. Incluye `orderId`, `total` y, si paga por BRE-B, `instruccionesPago`      |
| `200`  | La llave de idempotencia ya creó un pedido: se devuelve ese mismo, con `yaExistia: true` |
| `400`  | Datos inválidos, con el detalle por campo                                                |
| `409`  | Carrito desactualizado: producto agotado, inexistente o con precio distinto              |

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
