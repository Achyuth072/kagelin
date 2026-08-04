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
  // Deno entrypoints are unreachable by tsc, so lint is their only gate.
  // (_shared modules are checked — tests/unit pulls them into the program.)
  {
    files: ["supabase/**/*.ts"],
    rules: {
      "@typescript-eslint/no-use-before-define": [
        "error",
        { functions: false, classes: false, variables: true },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "react-compiler/react-compiler": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "sonner",
              message:
                "Import notify from '@/lib/notify' instead — see docs/adr/0008-toasts-behind-owned-notify-interface.md.",
            },
          ],
        },
      ],
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
  // notify.ts and toaster.tsx are the only files allowed to import sonner
  // directly — everywhere else routes through notify.
  {
    files: ["src/lib/notify.ts", "src/components/ui/toaster.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
