import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    // Platform CDNs provide animated, zero-width and native-size chat assets.
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    // Existing integrations parse platform-specific payloads and synchronize native streams.
    files: [
      "app/chat/page.tsx",
      "components/chat/model.ts",
      "lib/**/*.ts",
      "app/api/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
]);
