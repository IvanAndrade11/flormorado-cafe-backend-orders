import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

// Config aparte para `npm run test:contract` (FMC-0030). Nunca la usa
// `npm test`/CI: el test que cubre vive en `test/contract/`, fuera del
// `include` ("src/**/*.test.ts") de `vitest.config.mts`, porque depende de
// que el repo hermano `flormorado-cafe-frontend-react-app` esté clonado al
// lado de este (ver `docs/pruebas-cruzadas.md`) — algo que el checkout de un
// solo repo en GitHub Actions nunca tiene.
//
// El test importa código real de los dos repos en el mismo proceso: el `app`
// de este backend (sus imports usan `@/...` -> este `src/`) y
// `buildOrderPayload` del frontend (sus imports usan `@/...` -> SU `src/`).
// Un alias global no puede significar dos cosas a la vez, así que este plugin
// resuelve `@/...` según el archivo que hace el import, no de forma fija.
const backendSrc = fileURLToPath(new URL("./src", import.meta.url));
const frontendSrc = fileURLToPath(
  new URL("../flormorado-cafe-frontend-react-app/src", import.meta.url),
);

const crossRepoAtAlias = (): Plugin => ({
  name: "cross-repo-at-alias",
  resolveId(source, importer) {
    if (!source.startsWith("@/")) return null;

    const base = importer?.includes("flormorado-cafe-frontend-react-app")
      ? frontendSrc
      : backendSrc;

    return this.resolve(path.join(base, source.slice(2)), importer, {
      skipSelf: true,
    });
  },
});

export default defineConfig({
  plugins: [crossRepoAtAlias()],
  test: {
    include: ["test/contract/**/*.test.ts"],
  },
});
