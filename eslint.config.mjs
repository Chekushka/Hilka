import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The spike is deliberately outside the application: plain JS, no build
    // step, vendored engine. It answered its questions and is not app code.
    "spike/**",
    // Copied out of node_modules by scripts/sync-skulpt.mjs.
    "public/runner/**",
    // Design deliverables, not source.
    "docs/**",
  ]),
]);

export default eslintConfig;
