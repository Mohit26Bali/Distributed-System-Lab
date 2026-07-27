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
  ]),
  // Simulation First (docs/01-architecture.md): the simulation layer must
  // stay framework-free and UI-independent. src/store is the only
  // permitted bridge between it and React/Zustand/components.
  {
    files: ["src/simulation/**/*.ts", "src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "zustand"],
          patterns: ["@/components/*", "@/store/*"],
        },
      ],
    },
  },
]);

export default eslintConfig;
