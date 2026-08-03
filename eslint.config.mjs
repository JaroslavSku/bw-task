import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptRules from "eslint-config-next/typescript";

export default defineConfig([
  ...coreWebVitals,
  ...typescriptRules,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "migrations/**"]),
]);
