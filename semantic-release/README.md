<div align="center">

<img alt="" src="../.github/assets/semantic-release.webp" width="270" height="180" />

# semantic-release

[![semantic-release: conventional commits](https://img.shields.io/badge/semantic--release-conventionalcommits-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

Runs [semantic-release](https://semantic-release.org/) with a locked, known-good
set of packages, so individual release workflows don't have to manage version
pins.

</div>

## Why

The [documented way](https://semantic-release.org/usage/running/) to run
semantic-release in CI is `npx`, and its goals are sound: install the toolchain
fresh at release time only, keep it out of `devDependencies`, and pin versions —
"Pinning semantic-release to an exact version makes your releases even more
deterministic." But the `npx` mechanism has bitten twice:

- **Unpinned, it silently breaks on upstream majors.**
  `npx --package semantic-release --package conventional-changelog-conventionalcommits semantic-release`
  worked until `conventional-changelog-conventionalcommits@10` shipped: its new
  `writerOpts` format doesn't match the `conventional-changelog-writer@8` that
  `semantic-release` pins internally, so the preset and writer fell out of sync
  and release notes came out empty — no error, just missing output.
- **Pinned, it leaks into git hooks.** `npx` exports its `--package` specs to
  child processes as `npm_config_package`, so every process semantic-release
  spawns inherits them — including git hooks fired by `git push`. A hook that
  runs `npx` in no-install mode (e.g. husky's common `npx --no -- commitlint`)
  picks up the leaked _ranged_ specs, which `npx` always re-resolves against the
  registry, and `--no` turns that scheduled install into a hard failure. Bare
  (unpinned) names don't trigger it — the failure appears exactly when you add
  the pins.

This action implements the spirit of the recommendation without `npx`: the
toolchain lives in this directory's `package.json` + `package-lock.json`,
installed with `npm ci` into the action's own path at release time, and the CLI
binary is invoked directly.

## Usage

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0

- uses: actions/setup-node@v6
  with:
    node-version: lts/*

# build / test / lint

- name: Release
  uses: igordanchenko/actions/semantic-release@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Environment variables set on the step propagate into the action, so provide
whatever semantic-release's authentication needs — such as `GITHUB_TOKEN` — in
`env`.

The locked set is `semantic-release`,
`conventional-changelog-conventionalcommits`, and `@semantic-release/exec`.
Plugins beyond that go in `packages` — pin them, the action can only vouch for
its own lockfile:

```yaml
- name: Release
  uses: igordanchenko/actions/semantic-release@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    packages: |
      @semantic-release/changelog@6
      @semantic-release/git@10
```

## Inputs

| Input               | Default | Description                                                       |
| ------------------- | ------- | ----------------------------------------------------------------- |
| `packages`          | —       | Extra packages to install alongside the locked set (npm specs)    |
| `args`              | —       | Extra CLI arguments passed to semantic-release (e.g. `--dry-run`) |
| `working-directory` | `.`     | Directory to release from                                         |

## Outputs

None.

## Notes

Git hooks are disabled while the release runs (`HUSKY=0`, plus
`core.hooksPath=/dev/null` via `GIT_CONFIG_*` environment variables, which
covers every hook manager uniformly). This is independent of the `npx` leak
above: semantic-release pushes a tag — and a release commit, if the caller adds
`@semantic-release/git` — and in CI those hooks are installed, so the push fires
the caller's `pre-push`/`pre-commit` hooks. Hooks guard local development; by
the time a release job runs, CI has already validated the commits, so re-running
them here only redoes that work or fails the release outright.

The action assumes a current LTS Node on `PATH` (run `actions/setup-node` first)
and a full-history checkout (`fetch-depth: 0`), which semantic-release needs to
analyze commits.

"It installs" proves nothing here — the incompatibility above produced empty
release notes with exit code 0. So the lockfile is gated on generated output:
`toolchain.test.js` dry-runs the pinned `semantic-release` binary against a
throwaway git repo holding a `fix:`, a `feat:`, and a breaking change, then
asserts that the computed next version is correct and that the release notes
contain the expected sections and commit subjects — the exact seam that broke.
Renovate updates the whole locked set in a single grouped PR, so the test always
evaluates a coherent candidate set rather than packages bumped in isolation, and
this repo's own releases run through the action itself, so no version ships that
hasn't released with its own toolchain.

The locked set needs no install scripts, so `npm ci` runs with
`--strict-allow-scripts`: a toolchain bump that introduces one — the classic
compromised-package signature — fails the install loudly instead of executing
it. On npm without the flag (< 11.16) it degrades to an "Unknown cli config"
warning and today's default behavior. Caller-supplied `packages` are installed
without this restriction — pinning and vetting those remains the caller's job.

After `npm ci`, the action runs `npm audit signatures` on the locked set. The
lockfile's integrity hashes already pin tarball contents; this additionally
verifies the registry's signatures over those tarballs and the provenance
attestations that semantic-release and its plugins publish. It runs before the
`packages` install — those are installed `--no-save`, so they're absent from the
lockfile the audit reads, and vouching for them is the caller's job anyway. Only
invalid signatures fail the release; packages a private mirror serves without
signatures are skipped, not rejected.

## License

MIT © 2026 [Igor Danchenko](https://github.com/igordanchenko)
