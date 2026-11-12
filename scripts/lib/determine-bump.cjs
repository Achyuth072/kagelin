const semver = require("semver");
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

function getPrereleaseTargetRank(version) {
  const parsed = semver.parse(version);
  if (!parsed) return 0;
  if (parsed.minor === 0 && parsed.patch === 0) return 2;
  if (parsed.patch === 0) return 1;
  return 0;
}

function shouldEscalatePrerelease(currentVersion, bump) {
  if (!bump) return false;
  return BUMP_RANK[bump] > getPrereleaseTargetRank(currentVersion);
}

module.exports = {
  determineBump,
  BUMP_RANK,
  getPrereleaseTargetRank,
  shouldEscalatePrerelease,
};
