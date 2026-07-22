import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { recommended as tailwindRecommended } from "@poupe/eslint-plugin-tailwindcss";
import reactCompiler from "eslint-plugin-react-compiler";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  tailwindRecommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Ignore generated service worker
    "public/sw.js",
  ]),
  // CJS files: require() is expected in CommonJS
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Custom rule overrides
  {
    rules: {
      // Allow underscore-prefixed unused variables (common pattern for intentionally unused params)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "react-compiler/react-compiler": "error",
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CatchClause > BlockStatement[body.length=1] > ExpressionStatement > CallExpression[callee.object.name='console']",
          message:
            "Catch block only logs to console — the error is silently absorbed. Rethrow, surface it to the caller/UI, or report it (e.g. Sentry.captureException).",
        },
      ],
    },
    plugins: {
      "react-compiler": reactCompiler,
    },
  },
]);

export default eslintConfig;
