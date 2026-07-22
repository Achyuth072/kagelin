const CONVENTIONAL_COMMIT_RE = /^(\w+)(?:\([^)]+\))?(!)?:\s*(.+)$/;

// What each conventional-commit type means to a release: how it bumps
// semver, and which changelog section (if any) it belongs in. refactor
// only shows on preview — dev-speak subjects aren't fit for stable.
const COMMIT_TYPES = {
  feat: { bump: "minor", section: "Added" },
  fix: { bump: "patch", section: "Fixed" },
  perf: { bump: "patch", section: "Improved" },
  refactor: { bump: "patch", section: "Improved", stableVisible: false },
};

const SECTION_ORDER = ["Added", "Improved", "Fixed"];

function orderSections(sections) {
  const ordered = {};
  for (const section of SECTION_ORDER) {
    if (sections[section]?.length) ordered[section] = sections[section];
  }
  return ordered;
}

module.exports = {
  CONVENTIONAL_COMMIT_RE,
  COMMIT_TYPES,
  SECTION_ORDER,
  orderSections,
};
