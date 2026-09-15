# ☕ Flormorado Café — Backend de Pedidos

> Servicio que recibe los pedidos del checkout de [flormoradocafe.com](https://flormoradocafe.com), los guarda en una base de datos consultable y dispara las notificaciones de confirmación por correo y WhatsApp. Desplegado en Cloudflare Workers.

---

## 📋 Tabla de contenido

- [Descripción del proyecto](#-descripción-del-proyecto)
- [Estado actual](#-estado-actual)
- [Tecnologías principales](#️-tecnologías-principales)
- [Arquitectura del proyecto](#️-arquitectura-del-proyecto)
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

El checkout del frontend recolecta toda la información de un pedido (contacto, entrega y método de pago) pero no tenía a dónde enviarla: al confirmar, el pedido no se guardaba ni notificaba a nadie. Este servicio cierra ese ciclo.

Los dos métodos de pago del negocio —**contraentrega** y **llave BRE-B**— no requieren cobro en línea, así que aquí no hay pasarela de pago. Lo que hace el servicio es:

- **Recibir y validar** el pedido, recalculando el total en el servidor.
- **Guardarlo** en una base de datos SQL antes de intentar cualquier notificación, para que un fallo de correo o WhatsApp nunca signifique un pedido perdido.
- **Notificar** al cliente por correo y WhatsApp, y al negocio con un resumen periódico de pedidos nuevos.
- **Exponer un panel** protegido para consultar los pedidos y avanzar su estado.

---

## 🚦 Estado actual

Este repositorio está en construcción por fases. Lo que ya existe:

| Fase | Alcance                              | Estado         |
| ---- | ------------------------------------ | -------------- |
| 1    | Andamiaje, tooling, CI y documentación | ✅ Completa    |
| 2    | Núcleo del pedido y base de datos D1 | ⏳ Pendiente   |
| 3    | Canal de correo (Resend)             | ⏳ Pendiente   |
| 4    | Panel de control de pedidos          | ⏳ Pendiente   |
| 5    | Conexión con el checkout del frontend | ⏳ Pendiente  |
| 6    | Canal de WhatsApp (Meta Cloud API)   | ⏳ Pendiente   |
| 7    | Endurecimiento (CORS, rate limit, dominio) | ⏳ Pendiente |

Hoy el servicio expone únicamente `GET /health`. No hay base de datos ni endpoint de pedidos todavía.

---

## 🛠️ Tecnologías principales

| Categoría          | Tecnología                                                    |
| ------------------ | ------------------------------------------------------------- |
| **Runtime**        | Cloudflare Workers                                            |
| **Framework HTTP** | Hono 4                                                        |
| **Lenguaje**       | TypeScript 5 (strict)                                         |
| **Base de datos**  | Cloudflare D1 (SQLite) — desde la fase 2                      |
| **Correo**         | Resend — desde la fase 3                                      |
| **WhatsApp**       | Meta WhatsApp Cloud API — desde la fase 6                     |
| **Formateo**       | Prettier                                                      |
| **Linter**         | ESLint 10 (flat config) + typescript-eslint                   |
| **Testing**        | Vitest                                                        |
| **CI**             | GitHub Actions (type-check, lint, formato, tests y build)      |
| **Deploy**         | Wrangler                                                      |

---

## 🏗️ Arquitectura del proyecto

Servicio HTTP en capas separadas por responsabilidad, siguiendo la misma organización del frontend (barriles `index.ts`, tipos aparte, constantes en `utils`).

```
src/
├── index.ts          → punto de entrada, app de Hono y montaje de rutas
├── routes/           → un archivo por grupo de endpoints
├── types/            → definiciones de tipos TypeScript
└── utils/constants/  → constantes compartidas
```

Las carpetas `db/`, `services/`, `schemas/` y `templates/` se agregan en las fases donde tienen contenido real, no antes.

**Alias de rutas:** `@/*` → `src/*`, declarado en `tsconfig.json` y en `vitest.config.mts`. Si se cambia, hay que actualizar los dos.

---

## 📋 Requisitos previos

- **Node.js** 22 o superior
- **npm** 10 o superior
- Una cuenta de [Cloudflare](https://dash.cloudflare.com) (plan Free) para desplegar

---

## ⚙️ Instalación y configuración

```bash
npm install
```

Para vincular la CLI de Cloudflare con tu cuenta (una sola vez por máquina):

```bash
npx wrangler login
```

Luego, para levantar el servicio en local:

```bash
npm start
```

Queda escuchando en `http://localhost:8787`.

---

## 🔐 Variables de entorno

Los secretos viven en el almacén de Cloudflare, nunca en el repositorio. Se cargan con:

```bash
npx wrangler secret put NOMBRE_DEL_SECRETO
```

Para desarrollo local, se usa un archivo `.dev.vars` en la raíz (ignorado por git).

Actualmente el servicio no requiere ninguna variable. Las que se irán agregando por fase:

| Variable                   | Fase | Descripción                                          |
| -------------------------- | ---- | ---------------------------------------------------- |
| `RESEND_API_KEY`           | 3    | API key de Resend para enviar correos                |
| `ORDERS_EMAIL_TO`          | 3    | Correo de la empresa que recibe el resumen de pedidos |
| `ORDERS_EMAIL_FROM`        | 3    | Remitente verificado (`pedidos@flormoradocafe.com`)  |
| `ADMIN_PASSWORD`           | 4    | Clave de acceso al panel de pedidos                  |
| `ALLOWED_ORIGIN`           | 7    | Origen autorizado para CORS                          |
| `WHATSAPP_TOKEN`           | 6    | Token permanente de Meta                             |
| `WHATSAPP_PHONE_NUMBER_ID` | 6    | ID del número registrado en la Cloud API             |
| `TURNSTILE_SECRET`         | 7    | Secreto del widget de Turnstile                      |

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

Para correr un solo archivo de pruebas: `npx vitest run src/routes/health.test.ts`

---

## 🔌 Endpoints

| Método | Ruta      | Descripción                                    |
| ------ | --------- | ---------------------------------------------- |
| `GET`  | `/health` | Verifica que el servicio está arriba y responde |

---

## 🚀 Despliegue

```bash
npm run deploy
```

Wrangler compila y publica el Worker en la cuenta con la que se hizo `wrangler login`. El CI no despliega: solo verifica que el bundle compile.

---

## 📄 Licencia

ISC

---

## 👤 Autor

**Iván Andrade** — Colombia
