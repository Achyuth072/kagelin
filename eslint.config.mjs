import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { recommended as tailwindRecommended } from "@poupe/eslint-plugin-tailwindcss";
import reactCompiler from "eslint-plugin-react-compiler";
import { plugin as shadcnPlugin } from "@shadcn/lint";
import noUnboundedSupabaseSelect from "./eslint-rules/no-unbounded-supabase-select.mjs";

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
      "react-hooks/set-state-in-effect": "off",
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
      "local/no-unbounded-supabase-select": "error",
      "shadcn/no-restyle": [
        "error",
        {
          allow: [
            "layout",
            "spacing",
            "shape",
            "color",
            "typography",
            "effects",
            "motion",
            "transition-seijaku",
            "transition-seijaku-*",
            "type-*",
            "sumi-red-action",
            "tabular-nums",
            "truncate",
            "break-words",
          ],
          deny: ["backdrop-blur*", "blur-*"],
          message: {
            effects:
              "Effects that violate DESIGN_SYSTEM.md (such as glassmorphism and blurs) are forbidden. Surfaces must be opaque matte.",
          },
        },
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CatchClause > BlockStatement[body.length=1] > ExpressionStatement > CallExpression[callee.object.name='console']",
          message:
            "Catch block only logs to console — the error is silently absorbed. Rethrow, surface it to the caller/UI, or record a diagnostic error.",
        },
      ],
    },
    plugins: {
      "react-compiler": reactCompiler,
      shadcn: shadcnPlugin,
      local: {
        rules: {
          "no-unbounded-supabase-select": noUnboundedSupabaseSelect,
        },
      },
    },
    settings: {
      shadcn: {
        ui: "@/components/ui",
        note: "Refer to .scratch/product/DESIGN_SYSTEM.md for Kagelin design rules, tokens, and constraints.",
      },
    },
  },
  // src/components/ui contains primitives (Radix wrappers) which own base styling.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "shadcn/no-restyle": "off",
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
