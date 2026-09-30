import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "coverage/**",
      "src/lib/supabase/types.ts",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(^|\\s)(ml|mr|pl|pr|left|right)-[0-9a-z\\[]/]",
          message: "Use logical properties (ms-/me-/ps-/pe-/start-/end-) instead of physical ones.",
        },
      ],
    },
  },
);
