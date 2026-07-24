const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { stripVTControlCharacters } = require("node:util");

// SEMANTIC_RELEASE_BIN lets a canary workflow point this suite at a different
// toolchain install (e.g. latest unpinned versions) without editing the test.
const SEMANTIC_RELEASE =
  process.env.SEMANTIC_RELEASE_BIN || path.join(__dirname, "node_modules", ".bin", "semantic-release");

// Compatibility smoke test for the locked toolchain: runs the pinned
// semantic-release binary end-to-end (dry run) against a throwaway git repo
// with conventional commits, then asserts on the *generated output*. The
// preset/writer incompatibility this guards against (see README.md) produced
// empty release notes without any error, so an exit-code check is not enough —
// the assertions must see the actual sections and commit subjects.

// Runs git in `cwd` isolated from the developer's global/system config
// (signing, hooks) so the fixture behaves the same locally and in CI.
// `stdio: "pipe"` keeps git's stderr chatter (e.g. push progress) out of the
// test runner output; on failure it is still attached to the thrown error.
function git(cwd, ...args) {
  execFileSync("git", args, { cwd, env: gitEnv(), stdio: "pipe" });
}

function gitEnv() {
  const env = { ...process.env };
  env.GIT_CONFIG_GLOBAL = os.devNull;
  env.GIT_CONFIG_SYSTEM = os.devNull;
  return env;
}

// Builds a fixture: a bare "origin" plus a work repo holding a v1.0.0 baseline
// and one fix, one feature, and one breaking change on top of it.
function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "semantic-release-toolchain-"));
  const remote = path.join(root, "remote.git");
  const repo = path.join(root, "repo");

  execFileSync("git", ["init", "--bare", "-b", "main", remote], { env: gitEnv(), stdio: "pipe" });
  execFileSync("git", ["init", "-b", "main", repo], { env: gitEnv(), stdio: "pipe" });
  git(repo, "config", "user.name", "Fixture");
  git(repo, "config", "user.email", "fixture@example.com");
  git(repo, "remote", "add", "origin", `file://${remote}`);

  fs.writeFileSync(
    path.join(repo, ".releaserc.json"),
    JSON.stringify({
      branches: ["main"],
      plugins: [
        ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
        ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
      ],
    }),
  );

  git(repo, "add", ".");
  git(repo, "commit", "-m", "chore: baseline");
  git(repo, "tag", "v1.0.0");

  function commit(message) {
    git(repo, "commit", "--allow-empty", "-m", message);
  }

  commit("fix: guard against empty entry names");
  commit("feat: add adaptive size units");
  commit("feat!: drop legacy runtime\n\nBREAKING CHANGE: the legacy runtime is no longer supported.");

  git(repo, "push", "origin", "main", "--tags");

  return { root, repo };
}

// Runs the action's own semantic-release binary in dry-run mode and returns
// its combined stdout+stderr plus the release-notes portion of it. CI
// environment variables are scrubbed so the run behaves identically on a
// laptop and inside a GitHub Actions job (where env-ci would otherwise report
// the *host* workflow's branch and PR state); color is disabled so assertion
// failures print readable text instead of ANSI escapes.
function runSemanticRelease(repo) {
  const env = gitEnv();
  for (const key of Object.keys(env)) {
    if (/^(GITHUB_|CI$|FORCE_COLOR$)/.test(key)) {
      delete env[key];
    }
  }
  env.NO_COLOR = "1";

  const result = spawnSync(SEMANTIC_RELEASE, ["--dry-run", "--no-ci"], {
    cwd: repo,
    env,
    encoding: "utf8",
  });
  const output = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`);
  assert.equal(result.status, 0, `semantic-release exited with ${result.status}:\n${output}`);

  // Assert notes content against this slice, not the full log: commit-analyzer
  // logs every commit message it analyzes ("Analyzing commit: feat: ..."), so
  // a subject regex against the whole transcript could pass on log lines alone
  // even when the generated notes are empty.
  const marker = output.indexOf("Release note for version");
  assert.notEqual(marker, -1, `no release note in semantic-release output:\n${output}`);
  return { output, notes: output.slice(marker) };
}

describe(
  "semantic-release toolchain compatibility",
  { skip: !fs.existsSync(SEMANTIC_RELEASE) && "run `npm ci` in semantic-release/ first" },
  () => {
    let fixture;
    let output;
    let notes;

    before(() => {
      fixture = createFixture();
      ({ output, notes } = runSemanticRelease(fixture.repo));
    });

    after(() => {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    });

    test("analyzes conventional commits into the expected next version", () => {
      assert.match(output, /The next release version is 2\.0\.0/);
    });

    test("renders all release note sections", () => {
      assert.match(notes, /### Features/);
      assert.match(notes, /### Bug Fixes/);
      assert.match(notes, /### ⚠ BREAKING CHANGES/);
    });

    test("renders the commit subjects into the release notes", () => {
      assert.match(notes, /add adaptive size units/);
      assert.match(notes, /guard against empty entry names/);
      assert.match(notes, /the legacy runtime is no longer supported/);
    });
  },
);
