const tseslint = require("typescript-eslint");
const globals = require("globals");
const prettierConfig = require("eslint-config-prettier");

module.exports = tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".wrangler/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  prettierConfig,
);
