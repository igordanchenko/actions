const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "prune.js");

// Runs prune.js against a fixture manifest in a temp directory and returns the
// emitted notice plus the resulting file, raw and parsed. `pkg` may be a string
// to control formatting exactly; PRUNE/KEEP are unset unless given in `env`.
function run(pkg, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-"));
  const file = path.join(dir, "package.json");
  fs.writeFileSync(file, typeof pkg === "string" ? pkg : JSON.stringify(pkg, null, 2) + "\n");

  const childEnv = { ...process.env };
  delete childEnv.PRUNE;
  delete childEnv.KEEP;
  Object.assign(childEnv, env);

  const notice = execFileSync(process.execPath, [SCRIPT], { cwd: dir, env: childEnv })
    .toString()
    .trim();
  const src = fs.readFileSync(file, "utf8");
  return { notice, src, pkg: JSON.parse(src) };
}

describe("prune-package-json/prune.js", () => {
  test("defaults: prunes dev-phase fields and scripts, spares the rest", () => {
    const { notice, pkg } = run({
      name: "test-pkg",
      version: "1.0.0",
      files: ["dist"],
      publishConfig: { access: "public" },
      engines: { node: ">=18" },
      scripts: {
        build: "tsc",
        test: "vitest",
        lint: "eslint .",
        prepare: "husky",
        postinstall: "node setup.js",
        prepack: "npm run build",
      },
      devDependencies: { typescript: "^5.0.0" },
      prettier: {},
      "size-limit": [{ path: "dist/index.js" }],
      "lint-staged": {},
      packageManager: "npm@10.0.0",
    });

    assert.deepEqual(pkg, {
      name: "test-pkg",
      version: "1.0.0",
      files: ["dist"],
      publishConfig: { access: "public" },
      engines: { node: ">=18" },
      scripts: { postinstall: "node setup.js", prepack: "npm run build" },
    });
    assert.equal(
      notice,
      "::notice::prune-package-json: deleted devDependencies, packageManager, prettier, " +
        "size-limit, lint-staged, scripts.build, scripts.test, scripts.lint, scripts.prepare",
    );
  });

  test("keep spares default fields and scripts; prune deletes extras (comma-separated)", () => {
    const { pkg } = run(
      {
        name: "t",
        version: "1.0.0",
        custom: true,
        packageManager: "npm@10.0.0",
        prettier: {},
        scripts: { build: "tsc", prepare: "husky", postinstall: "patch-package" },
      },
      { PRUNE: "scripts.postinstall,custom", KEEP: "scripts.prepare,packageManager" },
    );

    assert.deepEqual(pkg, {
      name: "t",
      version: "1.0.0",
      packageManager: "npm@10.0.0",
      scripts: { prepare: "husky" },
    });
  });

  test("keep: scripts leaves all scripts untouched", () => {
    const scripts = { build: "tsc", prepare: "husky" };
    const { pkg } = run(
      { name: "t", version: "1.0.0", prettier: {}, scripts },
      { KEEP: "scripts" },
    );

    assert.deepEqual(pkg, { name: "t", version: "1.0.0", scripts });
  });

  test("prune: scripts.x wins over keep: scripts.x", () => {
    const { pkg } = run(
      { name: "t", version: "1.0.0", scripts: { prepare: "husky" } },
      { PRUNE: "scripts.prepare", KEEP: "scripts.prepare" },
    );

    assert.deepEqual(pkg, { name: "t", version: "1.0.0" });
  });

  test("removes the scripts object once every script is pruned", () => {
    const { pkg } = run({ name: "t", version: "1.0.0", scripts: { build: "tsc" } });

    assert.deepEqual(pkg, { name: "t", version: "1.0.0" });
  });

  test("preserves indentation and missing trailing newline; reports nothing to delete", () => {
    const fixture = '{\n\t"name": "t",\n\t"version": "1.0.0",\n\t"scripts": {\n\t\t"postinstall": "x"\n\t}\n}';
    const { notice, src } = run(fixture);

    assert.equal(src, fixture);
    assert.equal(notice, "::notice::prune-package-json: nothing to delete");
  });

  test("prune reaches nested paths; missing paths are a silent no-op", () => {
    const { notice, pkg } = run(
      { name: "t", version: "1.0.0", config: { port: 8080, host: "h" } },
      { PRUNE: "config.port missing.deep.path" },
    );

    assert.deepEqual(pkg, { name: "t", version: "1.0.0", config: { host: "h" } });
    assert.equal(notice, "::notice::prune-package-json: deleted config.port");
  });
});
