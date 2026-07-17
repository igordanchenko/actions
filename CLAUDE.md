# CLAUDE.md

## What this is

A monorepo of reusable GitHub actions, each in its own top-level directory.
Consumers reference an action by subpath and tag:
`igordanchenko/actions/<action>@v1`. There is no build step, package manager, or
test suite — actions are consumed directly from the repo tree.

## Actions

- `bundle-size/` — composite action that runs `size-limit --json`, extracts one
  entry's byte count, and writes a formatted kB string (e.g. `"12.34 kB"`,
  `"10 kB"`) into a `package.json` field so a shields.io dynamic badge can read
  it back from the npm registry. The rationale (bundlephobia rate-limiting vs.
  the registry serving static JSON) is documented in `bundle-size/README.md`.

## Conventions (patterns to follow when adding an action)

- Actions are `composite`, with logic inline in the `action.yml` `run:` block (
  no separate script files). Prefer small `node -e` one-liners for JSON/number
  work over adding tool dependencies.
- Pass inputs into a bash step via `env:` (uppercased, e.g. `ENTRY`), reference
  as `$ENTRY`; emit outputs to `$GITHUB_OUTPUT` and re-export through the
  top-level `outputs:` block. Start bash steps with `set -euo pipefail`.
- Each action gets its own `README.md` (Why / Usage / Inputs / Outputs); the
  root `README.md` is an index table — keep both in sync.
