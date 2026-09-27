# Contributing to Kagelin

Thanks for contributing to Kagelin! To maintain code quality, stability, and clean release boundaries, please follow these guidelines.

---

## ⚠️ Important: Target the `dev` Branch

Kagelin uses a dual-branch structure:

- **`main`**: Production & release branch. Direct PRs to `main` are blocked.
- **`dev`**: Active integration branch. **All PRs must target `dev`.**

### When Opening a Pull Request:

Because `main` is the repo's default branch on GitHub, opening a new PR will pre-fill `base: main`.
**You must switch the base branch to `dev`:**

1. In the PR creation screen (or by clicking **Edit** on an existing PR), change the **base** dropdown from `main` to `dev`.
2. Any PR targeting `main` (other than a release sync from `dev`) will fail the `Enforce dev as PR target` CI check.

---

## Getting Started

### Prerequisites

- **Node.js**: v24+
- **npm**

### Setup

```bash
# Clone the repository
git clone https://github.com/Achyuth072/kagelin.git
cd kagelin

# Switch to the dev branch and pull latest changes
git checkout dev
git pull origin dev

# Create your feature branch off dev
git checkout -b feat/your-feature-name

# Install dependencies (copies sql-wasm.wasm into public/)
npm install

# Start local dev server (Turbopack, port 3000)
npm run dev
```

> **Note on Service Worker / Offline:** The service worker (Serwist) is disabled during `npm run dev`. To test offline PWA capabilities or the service worker, build and serve production mode:
>
> ```bash
> npm run build && npm start
> ```

---

## Verification Before Submitting

Run the full validation suite before pushing:

```bash
npm run validate
```

This runs Prettier format checks, strict ESLint (`--max-warnings=13`), TypeScript typecheck, and Vitest unit tests in parallel.

### Other Useful Commands

```bash
npm run test         # Vitest in watch mode
npm run e2e          # Playwright end-to-end tests
npm run dead-code    # Knip scan for unused exports
npm run ast-grep     # Repo-specific structural AST lint rules
```

---

## PR Size & Scope

To keep reviews fast and prevent regressions:

- **Small slices**: Keep PRs focused (< ~500 non-test lines). If a feature grows larger, split it into sequential, atomic PRs.
- **Surgical changes**: Avoid unrelated formatting changes or touching adjacent code.
- **Link issues**: Mention the related issue in the PR description (`Fixes #...`).
