const CONVENTIONAL_COMMIT_RE = /^(\w+)(?:\([^)]+\))?(!)?:\s*(.+)$/;

// Single source of truth for what each conventional-commit type means to a
// release: how it bumps semver, and which changelog section (if any) it
// belongs in. refactor bumps like a patch but only shows on the preview
// channel — dev-speak subjects aren't fit for the stable audience.
const COMMIT_TYPES = {
  feat: { bump: "minor", section: "Added" },
  fix: { bump: "patch", section: "Fixed" },
  perf: { bump: "patch", section: "Improved" },
  refactor: { bump: "patch", section: "Improved", stableVisible: false },
};

module.exports = { CONVENTIONAL_COMMIT_RE, COMMIT_TYPES };
