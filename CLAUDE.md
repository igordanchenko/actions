# CLAUDE.md

## What this is

A monorepo of reusable GitHub actions, each in its own top-level directory.
Consumers reference an action by subpath and tag:
`igordanchenko/actions/<action>@v1`. There is no build step or package manager —
actions are consumed directly from the repo tree.

## Actions

- `bundle-size/` — composite action that runs `size-limit --json`, extracts one
  entry's byte count, and writes a formatted size string (adaptive `B`/`kB`/`MB`
  unit, 3 significant digits, e.g. `"12.3 kB"`) into a `package.json` field so a
  shields.io dynamic badge can read it back from the npm registry. The rationale
  (bundlephobia rate-limiting vs. the registry serving static JSON) is
  documented in `bundle-size/README.md`.
- `prune-package-json/` — composite action that deletes dev-phase fields
  (`devDependencies`, tool config blocks, etc.) and scripts from `package.json`
  before `npm publish`. Fields are pruned by a maintained default list; scripts
  by an allowlist of the lifecycle scripts npm may still run (deliberately
  excluding `prepare`, whose dominant use — `"prepare": "husky"` — is
  dev-phase). Inputs `prune`/`keep` extend either direction with shared
  dotted-path notation; delete wins on collision.

## Conventions (patterns to follow when adding an action)

- Actions are `composite`. Keep logic inline in the `action.yml` `run:` block
  while it stays small, preferring `node -e` one-liners for JSON/number work
  over adding tool dependencies. When a script outgrows a one-liner, extract it
  to a file next to `action.yml` and invoke it via
  `node "$GITHUB_ACTION_PATH/<script>.js"` (see `prune-package-json/`).
- Extracted scripts carry a zero-dependency `node:test` suite
  (`<script>.test.js` alongside), discovered by `node --test` from the repo
  root. `test.yml` runs it on PRs; `release.yml` runs it again before
  semantic-release, so a failing test blocks the release.
- The supported runtime is a release workflow on current LTS Node — these
  actions are tailored to release workflows, and releases typically run on
  current LTS. That's why CI tracks `lts/*` with no Node version matrix, and why
  scripts can assume modern Node APIs.
- Pass inputs into a bash step via `env:` (uppercased, e.g. `ENTRY`), reference
  as `$ENTRY`; emit outputs to `$GITHUB_OUTPUT` and re-export through the
  top-level `outputs:` block. Start bash steps with `set -euo pipefail`.
- Each action gets its own `README.md` (Why / Usage / Inputs / Outputs); the
  root `README.md` is an index table — keep both in sync.
