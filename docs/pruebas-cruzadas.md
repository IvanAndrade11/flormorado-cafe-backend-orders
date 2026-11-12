# Pruebas que cruzan frontend y backend (FMC-0030)

## El hueco que esto cierra

El frontend prueba componentes y lógica pura con Jest; este repo prueba rutas
llamando a `app.request()` directamente, con D1/ConfigCat/Resend mockeados a
mano (`src/routes/contact.test.ts` es el patrón). Ninguna de las dos suites
levanta los dos servicios juntos ni simula un pedido real completo: cada lado
prueba contra una copia del contrato del otro, escrita a mano (el mismo patrón
que ya documentan ambos `CLAUDE.md` para el regex del celular o las
transiciones de estado — "duplicate validation on both sides"). Un cambio que
desalinee esas copias solo se nota en producción, con un pedido real
rechazado.

`test/contract/orders.contract.test.ts` prueba el cruce real: importa
`buildOrderPayload` del frontend (código de producción, no una copia) para
armar el cuerpo exactamente como lo manda el checkout, y lo manda contra el
`app` real de este backend. Si cualquiera de los dos lados cambia el contrato
de forma incompatible, el test falla — sin depender de que alguien se
acuerde de actualizar la copia del otro lado.

## Por qué no está en `npm test` / CI

El test necesita el código fuente de `flormorado-cafe-frontend-react-app` en
disco, al lado de este repo (el layout que ya asume el desarrollo local: ver
el `CLAUDE.md` del frontend, sección "Environment"). El CI de este repo
(`.github/workflows/ci.yml`) hace `actions/checkout` de un solo repo, así que
`flormorado-cafe-frontend-react-app` nunca existe ahí — el test rompería en
cada PR sin tocar nada relacionado.

Por eso:

- El archivo vive en `test/contract/`, fuera de `src/`, que es el único
  directorio que mira el `include` de `vitest.config.mts`
  (`src/**/*.test.ts`). `npm test` ni lo ve.
- Tiene su propio script, `npm run test:contract`, y su propia config,
  `vitest.contract.config.mts`.

Es una verificación manual: córrela cuando toques `POST /orders`,
`buildOrderPayload`, el carrito o cualquier campo del contrato — antes de
mezclar la rama, no como parte del pipeline.

## Por qué hace falta una config de Vitest aparte

El test corre en un solo proceso dos módulos que usan el mismo alias `@/*`
para cosas distintas: las rutas de este backend (`@/schemas/order`, etc.
apuntan a `./src`) y `buildOrderPayload` del frontend (`@/utils/...` apunta a
SU `src`). Un alias global de Vite solo puede apuntar a un sitio, así que
`vitest.contract.config.mts` no usa el alias fijo de siempre: añade un
plugin que resuelve `@/...` según qué archivo hace el `import` (si el
`importer` cae dentro de `flormorado-cafe-frontend-react-app`, resuelve contra
el `src` del frontend; si no, contra el de este backend). Es la única forma
de importar los dos lados reales en el mismo test sin reescribir los imports
de ninguno de los dos repos.

## Qué no cubre

No hay D1, ConfigCat ni Resend reales — se mockean igual que en el resto de
la suite de este repo (este proyecto no tiene `@cloudflare/vitest-pool-workers`
todavía, ver el `CLAUDE.md` raíz de este repo). No prueba el navegador ni la
UI del checkout, solo el contrato HTTP que viaja entre los dos. Tampoco
reemplaza las pruebas unitarias de cada repo: cubre específicamente el cruce
que ninguna de las dos suites tocaba.
