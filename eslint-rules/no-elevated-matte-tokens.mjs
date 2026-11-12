/**
 * Flags Ink & Matte surface token violations (rounded-2xl+, shadow-md+, and backdrop-blur*)
 * on raw HTML/Motion JSX elements, custom *Class/*ClassName props, and cva()
 * variants that @shadcn/lint skips when `!site.component`.
 */

const FORBIDDEN_TOKEN_RE =
  /^(?:(?:rounded-(?:(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee)-)?(?:2xl|3xl))|(?:shadow-(?:md|lg|xl|2xl))|(?:backdrop-blur(?:-[a-z0-9-]+|\[[^\]]+\])?))$/;

function stripVariantAndModifiers(token) {
  const lastColon = token.lastIndexOf(":");
  const base = lastColon >= 0 ? token.slice(lastColon + 1) : token;
  const noImportant = base.startsWith("!") ? base.slice(1) : base;
  const slashIdx = noImportant.indexOf("/");
  return slashIdx >= 0 ? noImportant.slice(0, slashIdx) : noImportant;
}

function findForbiddenTokens(text) {
  const hits = [];
  for (const rawToken of text.split(/\s+/)) {
    if (!rawToken) continue;
    const utility = stripVariantAndModifiers(rawToken);
    if (FORBIDDEN_TOKEN_RE.test(utility)) {
      hits.push(rawToken);
    }
  }
  return hits;
}

function visitStringExpressions(node, onString) {
  if (!node) return;
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") onString(node.value, node);
      break;
    case "TemplateLiteral":
      for (const quasi of node.quasis) {
        onString(quasi.value.cooked ?? quasi.value.raw, quasi);
      }
      for (const expr of node.expressions) {
        visitStringExpressions(expr, onString);
      }
      break;
    case "JSXExpressionContainer":
      visitStringExpressions(node.expression, onString);
      break;
    case "ArrayExpression":
      for (const elem of node.elements) {
        visitStringExpressions(elem, onString);
      }
      break;
    case "ConditionalExpression":
      visitStringExpressions(node.consequent, onString);
      visitStringExpressions(node.alternate, onString);
      break;
    case "LogicalExpression":
      visitStringExpressions(node.left, onString);
      visitStringExpressions(node.right, onString);
      break;
    case "ObjectExpression":
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          if (
            prop.key.type === "Literal" &&
            typeof prop.key.value === "string"
          ) {
            onString(prop.key.value, prop.key);
          }
          visitStringExpressions(prop.value, onString);
        } else if (prop.type === "SpreadElement") {
          visitStringExpressions(prop.argument, onString);
        }
      }
      break;
    case "CallExpression":
      for (const arg of node.arguments) {
        visitStringExpressions(arg, onString);
      }
      break;
    default:
      break;
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow rounded-2xl+ and shadow-md+ tokens on JSX elements, style props, and cva() definitions",
    },
    schema: [],
    messages: {
      forbiddenToken:
        "Ink & Matte violation: '{{token}}' is forbidden on Kagelin surfaces. Use rounded-xl (or smaller) radii and opaque matte hairline borders / shadow-xs / shadow-sm instead.",
    },
  },
  create(context) {
    function reportForbiddenInNode(exprNode) {
      visitStringExpressions(exprNode, (text, reportNode) => {
        for (const token of findForbiddenTokens(text)) {
          context.report({
            node: reportNode,
            messageId: "forbiddenToken",
            data: { token },
          });
        }
      });
    }

    return {
      JSXAttribute(node) {
        if (!node.value || node.name.type !== "JSXIdentifier") return;
        const name = node.name.name;
        if (
          name !== "className" &&
          name !== "class" &&
          !/Class(?:Name)?$/.test(name)
        ) {
          return;
        }
        reportForbiddenInNode(node.value);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "cva") {
          for (const arg of node.arguments) {
            reportForbiddenInNode(arg);
          }
        }
      },
    };
  },
};

export default rule;
