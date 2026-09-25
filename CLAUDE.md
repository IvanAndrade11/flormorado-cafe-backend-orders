# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Flormorado Café — backend service that receives orders from the storefront checkout, persists them, and sends confirmation notifications. Runs on Cloudflare Workers. Spanish is the language used throughout documentation, comments, email copy, and admin panel UI.

The React storefront lives in a sibling directory, `../flormorado-cafe-frontend-react-app`, deployed separately to GitHub Pages at flormoradocafe.com. This service is what its checkout posts to. The two repos deliberately share conventions (scripts, CI shape, commit format, path aliases) so moving between them feels the same.

There is **no payment gateway** here, and adding one is not a gap to fill: the business's two payment methods are cash on delivery and BRE-B key transfer, neither of which involves an online charge.

## Commands

```bash
npm start                # local dev server at localhost:8787 (wrangler dev)
npm run build            # bundle without deploying — this is what CI runs
npm run deploy           # publish the Worker to Cloudflare
npm run prettier         # format src/**/*.{ts,json,md}
npm run prettier:check   # check formatting without writing
npm run lint             # ESLint over src/**/*.ts
npm run lint:fix         # ESLint with --fix
npm test                 # run the Vitest suite once
npm run test:watch       # Vitest in watch mode
npx tsc --noEmit         # type-check without emitting (no dedicated npm script)
npx wrangler login       # link the CLI to a Cloudflare account (once per machine)
```

To run a single test file, pass it to Vitest directly: `npx vitest run src/routes/health.test.ts`.

Tests live colocated with the source they cover (`health.ts` + `health.test.ts` in the same folder), matching the frontend's convention. Hono apps are runtime-agnostic, so routes are tested by calling `app.request(path)` directly — no Workers runtime needed for routing and handler logic.

`.github/workflows/ci.yml` runs `tsc --noEmit`, lint, format check, tests, and build on every PR to `main` and every push to `main` — treat a red CI check the same as a local failure. On pushes to `main` a second job, `deploy`, publishes the Worker with `cloudflare/wrangler-action` using the `CLOUDFLARE_API_TOKEN` repo secret. The checks job itself needs no credentials: `npm run build` is `wrangler deploy --dry-run`, which only bundles.

**The deploy job applies D1 migrations first, then publishes.** `d1 migrations apply flormorado-orders --remote` runs as its own step before the deploy step, so new code never goes live against a schema that lacks its columns — code that writes to a missing column fails every order. If the migration step fails, the deploy step doesn't run and production keeps the previous version. That requires the `CLOUDFLARE_API_TOKEN` to carry **D1: Edit**. Every migration must still be additive (new tables, nullable columns): for the seconds between the two steps, the old code runs against the new schema.

**The same timing gap applies to the request contract.** This service deploys automatically on merge; the storefront deploys by hand (`npm run deploy` in the frontend repo). Any new field in `POST /orders` has to be optional here, or the storefront already in production starts getting 400s the moment this repo merges. `contact.marketingConsentVersion` is optional for exactly that reason.

## Toolchain constraints

Three non-obvious decisions that will look like mistakes if the reasoning isn't recorded:

- **No `@cloudflare/vitest-pool-workers`.** The pool would give tests real D1/KV bindings, but its newest version (0.22.0) still peers on `vitest@^4.1.0`, and installing vitest 4 crashes npm's dependency resolver on this toolchain (`Cannot read properties of null (reading 'edgesOut')` in arborist's `#loadPeerSet`, triggered by vitest 4's peer graph). Vitest 5 installs cleanly, so the project runs plain Vitest 5. Revisit when the pool supports vitest 5 — that is the point at which D1 integration tests become worth it. Until then, test query-layer logic directly rather than through a binding.
- **`vitest.config.mts`, not `.ts`.** The package is CommonJS (no `"type": "module"`, matching the frontend's CommonJS configs), so an ESM config file needs the `.mts` extension or Vite warns and will eventually fail. Don't rename it back.
- **ESLint 10 here, ESLint 9 in the frontend.** The frontend is held at 9.x only because `eslint-plugin-react` doesn't officially support 10 yet. This service has no React, and ESLint 9 is past end of support, so it runs 10. The divergence is intentional.

## Commit messages

Follow the frontend repo's convention, one line, no body:

```
:gitmoji: TICKET-ID: short lowercase description, no trailing period
```

- `TICKET-ID` continues the shared `FMC-XXXX` series across both repos, so traceability holds end to end. The frontend went up to `FMC-0013`; this repo starts at `FMC-0014`.
- Branch names match the ticket: `feature/FMC-0014`.
- Keep the description short and imperative.
- Pick the gitmoji by change type: `:sparkles:` new feature, `:bug:` bug fix, `:memo:` docs, `:package:` deps/config, `:building_construction:` architecture/structural change, `:boom:` breaking change, `:wrench:` tooling/config.
- Do not add a commit body — put longer explanation in the PR description instead.

## Environment

Secrets live in Cloudflare's secret store, loaded with `npx wrangler secret put NAME`, and never in the repository. For local development they go in `.dev.vars` at the root, which is gitignored along with `.wrangler/`.

`README.md` lists every binding, secret and variable with its purpose. Secrets in production: `CONFIGCAT_SDK_KEY`, `RESEND_API_KEY`, `ORDERS_EMAIL_TO`, `ADMIN_PASSWORD`, and (optional, `FMC-0021`) `TURNSTILE_SECRET_KEY`. For local work `.dev.vars` needs at least `CONFIGCAT_SDK_KEY` and `ALLOWED_ORIGINS=http://localhost:3000` (it overrides the `wrangler.toml` value); without `RESEND_API_KEY` orders still save and the email failure is recorded in `email_status`, which is a useful way to exercise that path.

**TLS interception on the primary dev machine.** That machine sits behind a Netskope corporate gateway (`ca.adldigitallab.goskope.com`) which re-signs HTTPS. macOS trusts that CA, so browsers and system `curl` work normally, but Node uses its own bundled CA store and rejects it — every wrangler command that talks to Cloudflare fails with `fetch failed` / `SELF_SIGNED_CERT_IN_CHAIN`, and wrangler's own error text misleadingly blames general connectivity. The fix is to point Node at the system keychain:

```bash
export NODE_OPTIONS=--use-system-ca
```

Node 22.15+ supports this flag. It works whether or not the VPN client is running, since the interception is done by a system-level agent rather than the VPN tunnel. Keep this in the shell profile, **not** in the repo or CI — CI has no such interception and the flag would be wrong there. Never "fix" this with `NODE_TLS_REJECT_UNAUTHORIZED=0`, which disables certificate verification for all of Node, not just Cloudflare.

**The same gateway blocks `*.workers.dev`,** under its "Technology; Development Tools" category, and serves a 32 KB HTML interstitial instead of the response. Two consequences worth knowing before you spend time debugging a phantom outage:

- `wrangler deploy` and `wrangler dev --remote` fail from that machine with `Received a malformed response from the API` — the HTML block page where JSON was expected. **Deploys therefore run from GitHub Actions** (`.github/workflows/ci.yml`), which is the real reason that job exists.
- The deployed service cannot be reached from that machine at all, so **verifying it has to happen from outside**: a device off the corporate network, or after clicking through the gateway's own justification prompt. A failed `curl` to the workers.dev URL says nothing about whether the Worker is healthy — check `wrangler d1 execute --remote` (the Cloudflare API is not blocked) or the Cloudflare dashboard instead.

What *is* reachable from that machine: `api.cloudflare.com` (so D1 queries, secrets and migrations all work), `cdn-global.configcat.com`, `api.resend.com`, npm and GitHub.

## Architecture

**Entry point** (`src/index.ts`): creates the Hono app and mounts route groups with `app.route(prefix, group)`. Each group is its own `Hono` instance exported from `src/routes/`, registered in that folder's `index.ts` barrel — import from the barrel (`@/routes`), not from the file, matching the frontend's barrel convention.

**Path alias**: `@/*` → `src/*`, declared in **both** `tsconfig.json` and `vitest.config.mts`. Keep them in sync — a change in one without the other breaks either the type check or the tests, and the failure message won't point at the alias.

**Folder layering** under `src/`: `middleware/` (`adminAuth`, `rateLimit`), `routes/` (HTTP endpoints), `schemas/` (Zod validation for the order request, the contact request, and the ConfigCat catalog), `services/` (D1 access in `orders.ts`, plus ConfigCat, Resend, the hourly digest, and BRE-B payment instructions), `templates/` (email HTML), `types/` (the Worker `Env`), `utils/constants/` (cities, order statuses, pricing rules). New folders are added when something first needs them, not pre-created empty.

**Order of operations for a new order** (the rule most worth preserving): validate → recalculate the total from the ConfigCat catalog → **persist customer, order and line items in one `DB.batch`** → respond to the client → notify in `waitUntil`. Persistence comes before every notification so a failure in Resend or the WhatsApp API can never produce a lost order. Never trust a price or total sent by the browser; its prices are only compared, to detect a stale cart (409).

**Customers and consent** (`migrations/0004`). `customers` is keyed by the 10-digit cell phone, because that is how WhatsApp identifies a person, and is upserted by every order in the same batch — D1 runs a batch as a transaction, so a failed order insert (e.g. an idempotency race) rolls the customer write back too. The order finds its `customer_id` with a subquery on the phone rather than a `RETURNING`, since statements in a batch can't read each other's results. Business rules confirmed by the owner, which the SQL encodes:
- The latest order defines both the contact details and the WhatsApp marketing consent. An order with the box unchecked turns marketing off.
- `marketing_updated_at` only moves when the consent value actually changes (the `CASE` in the upsert reads the old row). `updated_at` moves on every order.
- Proof of consent under Colombia's Ley 1581 lives on `orders`: `whatsapp_opt_in` plus `marketing_consent_version` (the version of the checkbox text the customer saw) plus `created_at`. Don't aggregate it away.
- Counts, totals and purchase dates are derived from `orders`, never stored on `customers`.

**Webhook de WhatsApp (`/webhooks/whatsapp`).** Meta exige un endpoint público que responda antes de dejar terminar el registro del número en la Cloud API — no es un paso opcional que se pueda aplazar a cuando se integre el envío. El `GET` hace el "handshake" de verificación: compara `hub.verify_token` contra `WHATSAPP_VERIFY_TOKEN` (una cadena que inventamos nosotros) y, si coincide, devuelve `hub.challenge` tal cual. El `POST` valida que el evento venga realmente de Meta comparando el encabezado `X-Hub-Signature-256` contra un HMAC-SHA256 calculado con `WHATSAPP_APP_SECRET` (el "App secret" del panel de la app en Meta, no el token permanente de la fase 7); sin esto cualquiera que adivine la URL podría mandar eventos falsos. Por ahora el `POST` solo reconoce la entrega con un 200 — parsear el contenido (estados de entrega, respuestas de clientes) es trabajo de la fase 7, cuando exista algo real que hacer con esos eventos. Si no se responde 200, Meta reintenta con frecuencia decreciente durante 7 días y luego descarta el evento.

**BRE-B payment instructions.** `BREB_KEY` and `BREB_HOLDER` are `[vars]` in `wrangler.toml`, deliberately not secrets and not ConfigCat: they are shown to every customer anyway, and keeping them in git leaves a trail if someone swaps the key to redirect payments. `breBInstructions` (`src/services/payments.ts`) is the single source for both the `instruccionesPago` field of the response and the confirmation email, so the two can't disagree. The holder name matters: the customer's bank shows the recipient's (masked) name before confirming, and the email tells them what to check it against.

**Formulario de contacto (`/contact`, `FMC-0019`; guardado en D1 desde `FMC-0020`).** El mensaje se guarda en `contact_messages` **antes** de intentar el correo — mismo criterio que un pedido — para que el panel pueda mostrarlo y hacerle seguimiento aunque Resend falle o nadie mire el correo. Aun así `routes/contact.ts` sigue esperando el resultado de Resend antes de responder (a diferencia de `routes/orders.ts`, que notifica en `waitUntil`), y devuelve `502` si falla para que el frontend reintente. Como el mensaje ya quedó guardado en el primer intento, un reintento no debe crear una segunda fila: `findRecentDuplicate` (`src/services/contactMessages.ts`) busca un mensaje con el mismo correo y texto en los últimos 5 minutos y lo reutiliza en vez de insertar uno nuevo — no hay una llave de idempotencia explícita como en `/orders` porque el contrato del formulario de contacto no cambió. Reutiliza `ORDERS_EMAIL_TO` — el mismo buzón que recibe el resumen de pedidos — en vez de una variable nueva. El correo del cliente va como `reply-to`, no en el cuerpo del mensaje, para que el negocio responda con un solo clic sin tener que copiarlo.

**Panel de control (`/admin/*`, `FMC-0020`).** Expone en JSON lo que antes el plan preveía como HTML generado por el Worker: la interfaz vive en el frontend React (sitio estático en GitHub Pages), así que este servicio solo valida, consulta y escribe. Un solo usuario (el negocio), así que la autenticación es deliberadamente simple: `src/middleware/adminAuth.ts` exige `Authorization: Bearer <ADMIN_PASSWORD>` en tiempo constante, sin login, sesiones ni expiración — la clave *es* el token, y nunca viaja al frontend. `adminCors` (en `src/index.ts`, junto a `storeCors`) reutiliza `ALLOWED_ORIGINS` porque el panel es una ruta más del mismo sitio, pero a diferencia de `storeCors` permite `GET`/`PATCH` y el header `Authorization`. El límite de intentos de clave llegó en la Fase 8 (ver abajo).

La búsqueda `q` de `GET /admin/orders` cubre número de pedido, documento, celular, correo y nombre completo con un solo `LIKE` sobre esas columnas (`ORDER_FILTERS` en `src/services/orders.ts`): es lo que un cliente suele dar cuando pregunta por su pedido. `GET /admin/customers` reutiliza la misma idea (`CUSTOMER_FILTERS` en `src/services/customers.ts`): `q` sobre nombre completo, celular, correo y documento, más `marketing=1|0`, y con el mismo tope de 50 filas por defecto (200 máximo) que pedidos. `GET /admin/customers/:id` devuelve el historial de pedidos del cliente incluyendo `whatsapp_opt_in` y `marketing_consent_version` de cada uno — la prueba de consentimiento de la Ley 1581 vive en `orders`, así que el panel la lee de ahí y nunca de `customers`.

Las transiciones de estado (`nextStatuses` en `src/utils/constants/orders.ts`) dependen del método de pago del pedido, nunca de lo que mande el panel: `updateOrderStatus` (`src/services/orders.ts`) vuelve a consultar el pedido, calcula qué estados son válidos desde ahí y rechaza con `409` cualquier otro, dejando rastro en `order_status_history` (`migrations/0006`) solo cuando la transición aplica.

**Endurecimiento (Fase 8, `FMC-0021`).** Todo lo que sigue son capas contra el abuso, y la regla que las une es **fallar abierto**: perder una venta es peor que dejar pasar tráfico sin contar, y la protección real de los datos no depende de ellas.

- **Límites de tasa** (`src/middleware/rateLimit.ts`, bindings `[[ratelimits]]` de `wrangler.toml`): por IP en `/orders` (10/min), `/contact` (5/min) y `/admin/*` (30/min, antes de verificar la clave), y por correo del cliente en `/orders` (3/min, dentro de la ruta porque necesita el cuerpo ya parseado). Los bindings son **opcionales en `Env`**: sin ellos —pruebas, `wrangler dev` sin configurar— el servicio funciona igual. Cloudflare los cuenta por ubicación y de forma eventualmente consistente, y `period` solo admite 10 o 60. Se montan **después de `storeCors`/`adminCors`** para que el `429` lleve las cabeceras CORS y el navegador pueda leerlo. Las cifras son generosas porque muchos clientes comparten IP (datos móviles). No se usó D1 para contar: cada petición rechazada gastaría una escritura de la cuota diaria, así que el propio límite serviría para agotarla.
- **Turnstile** (`src/services/turnstile.ts`, encabezado `X-Turnstile-Token`): se exige solo si existe `TURNSTILE_SECRET_KEY`, para que el backend pueda desplegarse antes que el frontend sin rechazar la tienda vigente. En `/orders` se verifica **después** de buscar la llave de idempotencia (un reintento de un pedido ya creado no lo necesita) y con `idempotency_key` = la llave del pedido, porque el frontend reintenta con el mismo token y un token vale una sola vez. En `/contact`, que no tiene llave, se deriva un UUID de `token|correo|mensaje` (`uuidFromText`): repetir el mismo token con otro mensaje se rechaza. **No** se deriva solo del token: eso dejaría reutilizarlo durante sus 5 minutos de vida. Token ausente/inválido/vencido → `403`; Cloudflare caído o secreto mal configurado → pasa y se registra.
- **`/contact` no reenvía un duplicado ya enviado**: si `findRecentDuplicate` encuentra el mismo mensaje con `email_status = 'enviado'`, responde `201` sin llamar a Resend. Antes, repetir la misma petición reenviaba el correo al negocio cada vez.
- **Comparaciones de secretos** con `safeEqual` (`src/utils/security.ts`): reduce ambos lados a SHA-256 antes de comparar, así ni el tiempo ni el largo filtran nada. Lo usan la clave del panel y el `verify_token` del webhook; antes ambos usaban `===` o filtraban el largo. `adminAuth` rechaza si `ADMIN_PASSWORD` no está configurada, y marca `Cache-Control: no-store`.
- **Cuerpo máximo de 32 KB** (`bodyLimit`) en `/orders` y `/contact`, `secureHeaders()` global, y `onError`/`notFound` que responden JSON genérico: el log lleva ruta y mensaje, nunca el cuerpo, que trae datos personales.
- **Alerta de notificaciones fallidas** (`src/services/alerts.ts`, `migrations/0007`): el cron llama a `sendFailureAlerts` junto a `sendPendingDigest`. Considera fallido lo que dice `fallo…` o lleva más de 30 minutos en `pendiente`. `failure_alerted` solo se marca **después** de que el aviso salió; si Resend es lo que falla, el aviso se reintenta cada hora. La migración marca como avisado todo lo anterior para que el primer correo no traiga el historial de pruebas. `GET /admin/orders` devuelve `email_status` y `whatsapp_status` para que el panel marque la fila.
