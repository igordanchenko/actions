const fs = require("node:fs");

// Dev-phase fields with no business in a published artifact. `scripts` is not
// in this list — it gets allowlist treatment below so lifecycle scripts npm
// still needs can survive. Deleting a field that doesn't exist is a no-op, so
// this list can stay liberal: each project just ignores the entries it lacks.
const DEFAULT_FIELDS =
  ("devDependencies packageManager volta overrides resolutions pnpm workspaces " +
    "eslintConfig prettier stylelint jest babel browserslist size-limit " +
    "husky lint-staged nano-staged simple-git-hooks commitlint release").split(" ");

// Scripts npm itself may still run after this step: during `npm publish`
// (prepublishOnly, prepack, postpack, publish, postpublish) or on the
// consumer's machine at install time (preinstall, install, postinstall).
// `prepare` is deliberately absent — its dominant use ("prepare": "husky") is
// dev-phase, and registry consumers never run it; keep it back with
// `keep: scripts.prepare`.
const DEFAULT_SCRIPTS =
  "preinstall install postinstall prepublishOnly prepack postpack publish postpublish".split(" ");

function parsePaths(input) {
  return input.split(/[\s,]+/).filter(Boolean);
}

const prune = parsePaths(process.env.PRUNE ?? "");
const keep = new Set(parsePaths(process.env.KEEP ?? ""));

const src = fs.readFileSync("package.json", "utf8");
const pkg = JSON.parse(src);

const deleted = [];
function remove(path) {
  const keys = path.split(".");
  let node = pkg;
  for (const key of keys.slice(0, -1)) {
    if (typeof node !== "object" || node === null) {
      return;
    }
    node = node[key];
  }
  const last = keys.at(-1);
  if (node && typeof node === "object" && last in node) {
    delete node[last];
    deleted.push(path);
  }
}

for (const field of DEFAULT_FIELDS) {
  if (!keep.has(field)) {
    remove(field);
  }
}

// The allowlist pass below only ever deletes, so an explicit `prune` path can
// never be resurrected by `keep`: delete wins by construction.
for (const path of prune) {
  remove(path);
}

if (!keep.has("scripts") && pkg.scripts) {
  const survivors = new Set(DEFAULT_SCRIPTS);
  for (const path of keep) {
    if (path.startsWith("scripts.")) {
      survivors.add(path.slice("scripts.".length));
    }
  }
  for (const key of Object.keys(pkg.scripts)) {
    if (!survivors.has(key)) {
      remove(`scripts.${key}`);
    }
  }
  if (Object.keys(pkg.scripts).length === 0) {
    delete pkg.scripts;
  }
}

// Preserve the existing indentation and trailing newline, as `npm pkg` does.
const indent = src.match(/^[ \t]+/m)?.[0] ?? "  ";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, indent) + (src.endsWith("\n") ? "\n" : ""));

// When every script was removed the whole `scripts` object is gone, so report
// it as a single `scripts` (like any other whole-field deletion) instead of one
// noisy line per script. A surviving `pkg.scripts` means only some went, so the
// per-script entries stay — that's the accurate picture.
function collapseWholeScripts(paths) {
  const firstScript = paths.findIndex((path) => path.startsWith("scripts."));
  if (firstScript === -1) {
    return paths;
  }
  const collapsed = paths.filter((path) => !path.startsWith("scripts."));
  collapsed.splice(firstScript, 0, "scripts");
  return collapsed;
}

const reported = pkg.scripts ? deleted : collapseWholeScripts(deleted);

console.log(
  reported.length
    ? `::notice::prune-package-json: deleted ${reported.join(", ")}`
    : "::notice::prune-package-json: nothing to delete",
);
