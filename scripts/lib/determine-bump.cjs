const { CONVENTIONAL_COMMIT_RE, COMMIT_TYPES } = require("./commit-types.cjs");

const BUMP_RANK = { patch: 0, minor: 1, major: 2 };

function determineBump(subjects) {
  let bump = null;

  for (const subject of subjects) {
    const match = subject.match(CONVENTIONAL_COMMIT_RE);
    if (!match) continue;

    const [, type, breaking] = match;
    if (breaking) return "major";

    const candidate = COMMIT_TYPES[type]?.bump;
    if (!candidate) continue;
    if (bump === null || BUMP_RANK[candidate] > BUMP_RANK[bump]) {
      bump = candidate;
    }
  }

  return bump;
}

module.exports = { determineBump };
