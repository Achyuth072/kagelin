const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");
const semver = require("semver");
const { SECTION_ORDER } = require("./commit-types.cjs");

const MAJOR_OR_MINOR_TYPES = new Set([
  "major",
  "minor",
  "premajor",
  "preminor",
]);

function isMinorOrMajorRelease(currentVersion, incrementOrVersion) {
  if (!incrementOrVersion) return false;

  const inc = String(incrementOrVersion).toLowerCase();
  if (MAJOR_OR_MINOR_TYPES.has(inc)) {
    return true;
  }
  if (inc === "patch" || inc === "prepatch" || inc === "prerelease") {
    return false;
  }

  if (semver.valid(incrementOrVersion) && semver.valid(currentVersion)) {
    const diff = semver.diff(currentVersion, incrementOrVersion);
    return diff ? MAJOR_OR_MINOR_TYPES.has(diff) : false;
  }

  return false;
}

function resolveTargetVersion(currentVersion, incrementOrVersion) {
  if (semver.valid(incrementOrVersion)) {
    return incrementOrVersion;
  }
  return semver.inc(currentVersion, incrementOrVersion) || currentVersion;
}

function formatDiscussionTitle(version, titleSuffix) {
  const suffix = titleSuffix?.trim();
  return suffix ? `Release v${version}: ${suffix}` : `Release v${version}`;
}

function formatDiscussionBody(version, sections = {}) {
  const lines = [
    `Kagelin v${version} is now available!`,
    "",
    "### What's New",
    "",
  ];

  let hasSections = false;
  for (const section of SECTION_ORDER) {
    const items = sections[section];
    if (!items || items.length === 0) continue;
    hasSections = true;
    lines.push(`#### ${section}`, "");
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (!hasSections) {
    lines.push("_No user-facing changes in this build._", "");
  }

  lines.push(
    "### Feedback",
    "",
    "Try the update at [app.kagelin.app](https://app.kagelin.app/) and share any thoughts, bugs, or feedback in the replies below.",
  );

  return lines.join("\n").trim() + "\n";
}

function resolveDiscussionChoice(answer) {
  const normalized = answer.trim().toLowerCase();
  if (normalized === "e" || normalized === "edit") return "edit";
  if (normalized === "s" || normalized === "skip") return "skip";
  return "accept";
}

function parseDiscussionContent(rawText, defaultTitle = "Release") {
  const trimmed = rawText.trim();
  const lines = trimmed.split("\n");
  let title = defaultTitle;
  let bodyLines = lines;

  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.startsWith("#")) {
      title = firstLine.replace(/^#+\s*/, "").trim() || defaultTitle;
      bodyLines = lines.slice(1);
    } else if (firstLine.toLowerCase().startsWith("title:")) {
      title = firstLine.replace(/^title:\s*/i, "").trim() || defaultTitle;
      bodyLines = lines.slice(1);
    }
  }

  const body = bodyLines.join("\n").trim() + "\n";
  return { title, body };
}

function editDiscussionContent(title, body, execFn = execFileSync) {
  const tmpFile = path.join(os.tmpdir(), `discussion-curate-${Date.now()}.md`);
  const initialContent = `# ${title}\n\n${body}`;
  fs.writeFileSync(tmpFile, initialContent);
  try {
    const editor = process.env.EDITOR || process.env.VISUAL || "vi";
    execFn(editor, [tmpFile], { stdio: "inherit" });
    const edited = fs.readFileSync(tmpFile, "utf-8");
    return parseDiscussionContent(edited, title);
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

async function runDiscussionCurationLoop({
  version,
  sections = {},
  initialTitle,
  initialBody,
  rlInterface,
  editFn = editDiscussionContent,
}) {
  let title = initialTitle || formatDiscussionTitle(version);
  let body = initialBody || formatDiscussionBody(version, sections);

  const rl =
    rlInterface ||
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  const lines = rl[Symbol.asyncIterator]();

  try {
    for (;;) {
      console.log("\nGitHub Discussion Preview:");
      console.log(`Title: ${title}`);
      console.log("Category: Announcements");
      console.log("─".repeat(60));
      console.log(body.trim());
      console.log("─".repeat(60));
      process.stdout.write(
        "[a] accept as-is  [e] edit  [s] skip (default a): ",
      );

      const { value: answer, done } = await lines.next();
      if (done) return { title, body, skip: false };

      const choice = resolveDiscussionChoice(answer);
      if (choice === "accept") {
        return { title, body, skip: false };
      }
      if (choice === "skip") {
        return { title, body, skip: true };
      }

      try {
        const edited = editFn(title, body);
        title = edited.title;
        body = edited.body;
      } catch (err) {
        // eslint-disable-next-line no-restricted-syntax
        console.warn(
          `⚠ edit failed (${err.message}) — discussion content unchanged.`,
        );
      }
    }
  } finally {
    if (!rlInterface) {
      rl.close();
    }
  }
}

function getRepoInfo(execFn = execFileSync) {
  try {
    const remoteUrl = execFn("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const match = remoteUrl.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    // Deliberate fallback to default repository info.
  }
  return { owner: "Achyuth072", repo: "kagelin" };
}

function createGitHubDiscussion({
  version,
  sections,
  title: customTitle,
  body: customBody,
  titleSuffix,
  dryRun = false,
  execFn = execFileSync,
}) {
  const title = customTitle || formatDiscussionTitle(version, titleSuffix);
  const body = customBody || formatDiscussionBody(version, sections);

  if (dryRun) {
    console.log(`[dry-run] Would create GitHub discussion: "${title}"`);
    return { dryRun: true, title, body };
  }

  const { owner, repo } = getRepoInfo(execFn);

  try {
    // 1. Resolve repository ID and Announcements category ID
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          discussionCategory(slug: "announcements") {
            id
          }
        }
      }
    `;

    const repoDataRaw = execFn(
      "gh",
      [
        "api",
        "graphql",
        "-F",
        `owner=${owner}`,
        "-F",
        `repo=${repo}`,
        "-f",
        `query=${query}`,
      ],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const repoData = JSON.parse(repoDataRaw);
    const repositoryId = repoData?.data?.repository?.id;
    const categoryId = repoData?.data?.repository?.discussionCategory?.id;

    if (!repositoryId || !categoryId) {
      throw new Error(
        `Could not resolve repositoryId or Announcements categoryId for ${owner}/${repo}`,
      );
    }

    // 2. Create discussion mutation
    const mutation = `
      mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repositoryId,
          categoryId: $categoryId,
          title: $title,
          body: $body
        }) {
          discussion {
            id
            number
            url
            title
          }
        }
      }
    `;

    const createDataRaw = execFn(
      "gh",
      [
        "api",
        "graphql",
        "-F",
        `repositoryId=${repositoryId}`,
        "-F",
        `categoryId=${categoryId}`,
        "-F",
        `title=${title}`,
        "-F",
        `body=${body}`,
        "-f",
        `query=${mutation}`,
      ],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const createData = JSON.parse(createDataRaw);
    const discussion = createData?.data?.createDiscussion?.discussion;
    if (!discussion) {
      throw new Error("createDiscussion mutation returned no discussion data");
    }

    console.log(`✓ Created GitHub discussion: ${discussion.url}`);
    return discussion;
  } catch (err) {
    // Non-fatal per release design: warning only so release succeeds.
    console.warn(
      `⚠ Could not create GitHub discussion for v${version}: ${err.message}`,
    );
    return null;
  }
}

module.exports = {
  isMinorOrMajorRelease,
  resolveTargetVersion,
  formatDiscussionTitle,
  formatDiscussionBody,
  resolveDiscussionChoice,
  parseDiscussionContent,
  editDiscussionContent,
  runDiscussionCurationLoop,
  getRepoInfo,
  createGitHubDiscussion,
};
