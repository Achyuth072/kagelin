import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { plugin as shadcnPlugin } from "@shadcn/lint";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
});

const kagelinRestyleOptions = [
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
];

ruleTester.run(
  "shadcn/no-restyle with Kagelin config",
  shadcnPlugin.rules["no-restyle"],
  {
    valid: [
      {
        code: `<Button className="w-full mt-4 transition-seijaku-fast" />`,
        options: kagelinRestyleOptions,
      },
      {
        code: `<Card className="p-4 rounded-xl border border-border bg-card shadow-sm" />`,
        options: kagelinRestyleOptions,
      },
    ],
    invalid: [
      {
        code: `<Button className="backdrop-blur-sm" />`,
        options: kagelinRestyleOptions,
        errors: [
          {
            message:
              "Effects that violate DESIGN_SYSTEM.md (such as glassmorphism and blurs) are forbidden. Surfaces must be opaque matte.",
          },
        ],
      },
      {
        code: `<PopoverContent className="backdrop-blur-md" />`,
        options: kagelinRestyleOptions,
        errors: [
          {
            message:
              "Effects that violate DESIGN_SYSTEM.md (such as glassmorphism and blurs) are forbidden. Surfaces must be opaque matte.",
          },
        ],
      },
    ],
  },
);
