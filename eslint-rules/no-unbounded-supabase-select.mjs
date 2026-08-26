/**
 * Flags a Supabase read whose row count is never bounded.
 *
 * A truncated PostgREST response is an HTTP 200 with no error and, absent an
 * ORDER BY, keeps the *oldest* rows — so a counter built on it freezes rather
 * than visibly drifting.
 *
 * Only matches `.select()` chained directly onto `.from()`, which keeps
 * `.update(...).select()` and `.insert(...).select()` out of scope — those
 * return only the rows the write touched.
 */

const TERMINATORS = new Set(["range", "limit", "single", "maybeSingle"]);

/** Steps one link along a `.a().b()` chain, or returns null at its end. */
function nextLink(call) {
  const member = call.parent;
  if (!member || member.type !== "MemberExpression" || member.object !== call) {
    return null;
  }
  const next = member.parent;
  if (!next || next.type !== "CallExpression" || next.callee !== member) {
    return null;
  }
  return { member, call: next };
}

function chainHasTerminator(call) {
  for (let link = nextLink(call); link; link = nextLink(link.call)) {
    if (
      link.member.property.type === "Identifier" &&
      TERMINATORS.has(link.member.property.name)
    ) {
      return true;
    }
  }
  return false;
}

function chainTop(call) {
  let current = call;
  for (let link = nextLink(current); link; link = nextLink(current)) {
    current = link.call;
  }
  return current;
}

/** The `.from(table)` call a `.select()` is chained directly onto, if any. */
function directFromCall(selectCall) {
  const object = selectCall.callee.object;
  if (
    object.type === "CallExpression" &&
    object.callee.type === "MemberExpression" &&
    object.callee.property.type === "Identifier" &&
    object.callee.property.name === "from"
  ) {
    return object;
  }
  return null;
}

/** `.select(cols, { head: true })` asks for a count, not rows. */
function selectsHeadOnly(selectCall) {
  const options = selectCall.arguments[1];
  if (!options || options.type !== "ObjectExpression") return false;
  return options.properties.some(
    (property) =>
      property.type === "Property" &&
      !property.computed &&
      (property.key.name === "head" || property.key.value === "head") &&
      property.value.type === "Literal" &&
      property.value.value === true,
  );
}

/** The variable a chain is stored in, so later statements can extend it. */
function declaredVariable(sourceCode, top) {
  const parent = top.parent;
  if (parent.type !== "VariableDeclarator" || parent.init !== top) return null;
  return sourceCode.getDeclaredVariables(parent)[0] ?? null;
}

function referenceBoundsQuery(reference) {
  const identifier = reference.identifier;
  const parent = identifier.parent;
  if (!parent) return false;

  if (parent.type === "MemberExpression" && parent.object === identifier) {
    if (
      parent.property.type === "Identifier" &&
      TERMINATORS.has(parent.property.name)
    ) {
      return true;
    }
    const call = parent.parent;
    return (
      call?.type === "CallExpression" &&
      call.callee === parent &&
      chainHasTerminator(call)
    );
  }

  // Passed to another function — whatever bound it needs is that callee's job,
  // and we can't follow it, so don't guess.
  return (
    parent.type === "CallExpression" && parent.arguments.includes(identifier)
  );
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Supabase reads to page, cap, or single-row themselves rather than relying on PostgREST's silent 1000-row truncation.",
    },
    schema: [],
    messages: {
      unbounded:
        "Unbounded .select() on {{table}} — PostgREST silently truncates at 1000 rows. Page it with fetchAllRows(...) + .range(), cap it with .limit(), or use .single()/.maybeSingle().",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const candidates = [];

    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.property.type !== "Identifier" ||
          node.callee.property.name !== "select"
        ) {
          return;
        }
        const fromCall = directFromCall(node);
        if (fromCall) candidates.push({ node, fromCall });
      },

      // Deferred: node.parent is only assigned as traversal reaches each node,
      // so a chain's later links aren't visible from the .select() itself.
      "Program:exit"() {
        for (const { node, fromCall } of candidates) {
          if (selectsHeadOnly(node)) continue;
          if (chainHasTerminator(node)) continue;

          const variable = declaredVariable(sourceCode, chainTop(node));
          if (variable?.references.some(referenceBoundsQuery)) continue;

          const argument = fromCall.arguments[0];
          context.report({
            node,
            messageId: "unbounded",
            data: { table: argument ? sourceCode.getText(argument) : "table" },
          });
        }
      },
    };
  },
};

export default rule;
