/**
 * Enforces `strokeWidth={2.25}` on every `<Icon />` imported from `lucide-react`.
 *
 * Uses import-declaration resolution so non-Lucide components with their own
 * `strokeWidth` prop (Recharts `<Line>`/`<Area>`, `<CircularProgress>`, raw `<svg>`)
 * are never flagged. Intentional bold `strokeWidth={3}` / `{3.5}` overrides on
 * checkboxes, dropdown checks, and select carets in `src/components/ui/` remain allowed.
 */

const UI_DIR_RE = /(?:^|\/)src\/components\/ui\//;
const UI_ALLOWED_WIDTHS = new Set([2.25, 3, 3.5]);

function extractNumericStrokeWidth(attr) {
  if (!attr.value) return null;
  if (attr.value.type === "Literal") {
    const parsed = Number(attr.value.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (attr.value.type === "JSXExpressionContainer") {
    const expr = attr.value.expression;
    if (expr.type === "Literal" && typeof expr.value === "number") {
      return expr.value;
    }
    if (
      expr.type === "Literal" &&
      typeof expr.value === "string" &&
      expr.value.trim() !== ""
    ) {
      const parsed = Number(expr.value);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require explicit strokeWidth={2.25} on lucide-react icon components",
    },
    schema: [],
    messages: {
      missingStrokeWidth:
        "Lucide icon '<{{name}}>' must set strokeWidth={2.25} for ink weight consistency per DESIGN.md.",
      invalidStrokeWidth:
        "Lucide icon '<{{name}}>' must use strokeWidth={2.25} per DESIGN.md.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    const isUiPrimitive = UI_DIR_RE.test(filename);
    const lucideLocals = new Map();
    const lucideNamespaces = new Set();

    function resolveLucideIconName(nameNode) {
      if (nameNode.type === "JSXIdentifier") {
        return lucideLocals.has(nameNode.name) ? nameNode.name : null;
      }
      if (
        nameNode.type === "JSXMemberExpression" &&
        nameNode.object.type === "JSXIdentifier" &&
        lucideNamespaces.has(nameNode.object.name) &&
        nameNode.property.type === "JSXIdentifier"
      ) {
        return `${nameNode.object.name}.${nameNode.property.name}`;
      }
      return null;
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "lucide-react") return;
        if (node.importKind === "type") return;

        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier") {
            if (spec.importKind === "type") continue;
            lucideLocals.set(spec.local.name, spec.imported.name);
          } else if (spec.type === "ImportNamespaceSpecifier") {
            lucideNamespaces.add(spec.local.name);
          }
        }
      },

      JSXOpeningElement(node) {
        if (lucideLocals.size === 0 && lucideNamespaces.size === 0) return;

        const iconName = resolveLucideIconName(node.name);
        if (!iconName) return;

        const strokeAttr = node.attributes.find(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name.type === "JSXIdentifier" &&
            attr.name.name === "strokeWidth",
        );

        if (!strokeAttr) {
          context.report({
            node,
            messageId: "missingStrokeWidth",
            data: { name: iconName },
          });
          return;
        }

        const value = extractNumericStrokeWidth(strokeAttr);
        const isAllowed = isUiPrimitive
          ? value !== null && UI_ALLOWED_WIDTHS.has(value)
          : value === 2.25;

        if (!isAllowed) {
          context.report({
            node: strokeAttr,
            messageId: "invalidStrokeWidth",
            data: { name: iconName },
          });
        }
      },
    };
  },
};

export default rule;
