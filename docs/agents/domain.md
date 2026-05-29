# Domain Docs

## Before exploring, read these

- **`.planning/PROJECT.md`** — project identity, design philosophy, core value proposition
- **`.planning/REQUIREMENTS.md`** — canonical feature requirements
- **`.planning/DESIGN_SYSTEM.md`** — ink & matte aesthetic, typography, colour rules
- **`.planning/ROADMAP.md`** — completed phases and upcoming work
- **`.planning/codebase/ARCHITECTURE.md`** — system architecture
- **`.planning/codebase/CONVENTIONS.md`** — coding conventions
- **`.planning/codebase/STACK.md`** — tech stack decisions
- **`.planning/codebase/STRUCTURE.md`** — directory layout
- **`.planning/codebase/TESTING.md`** — testing approach
- **`.planning/codebase/INTEGRATIONS.md`** — external integrations
- **`.planning/codebase/CONCERNS.md`** — known concerns / open questions

Read the files relevant to the area you're about to work in. If none exist yet, proceed silently.

## File structure

Single-context repo. All domain docs live under `.planning/`.

## Use the project's vocabulary

When naming domain concepts (issue titles, refactor proposals, hypotheses, test names), use
terms as defined in `.planning/PROJECT.md` and `.planning/REQUIREMENTS.md`. Don't drift to
synonyms the docs explicitly avoid.

## Flag architectural conflicts

If your output contradicts a decision in `.planning/codebase/`, surface it explicitly:

> _Contradicts the convention in ARCHITECTURE.md — but worth revisiting because…_
