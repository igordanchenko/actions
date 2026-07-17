<p align="center">
  <img alt="" src="../.github/assets/prune-package-json.webp" width="180" height="180" />
</p>

<h1 align="center">
  prune-package-json
</h1>

<div align="center">

[![semantic-release: conventional commits](https://img.shields.io/badge/semantic--release-conventionalcommits-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

</div>

Deletes dev-phase fields and scripts from `package.json` before publishing to
npm, so the published manifest carries only what consumers need.

## Why

A typical `package.json` accumulates entries that only matter during
development: `scripts`, `devDependencies`, tool config blocks (`prettier`,
`lint-staged`, `size-limit`, …), environment pins like `packageManager`. None of
them belong in the published artifact — but pruning them per-repo means
maintaining the same delete list across every project, so the list inevitably
stays minimal and drifts.

This action centralizes the list. Deleting a field that doesn't exist is a
no-op, so the defaults can be liberal: each project just ignores the entries it
doesn't have, and extending the list here extends it everywhere at once.

## Usage

Add a step to your release workflow, after the build and before publishing:

```yaml
- name: Prune package.json
  uses: igordanchenko/actions/prune-package-json@v1
```

Adjust the defaults with `prune` and `keep` when needed:

```yaml
- name: Prune package.json
  uses: igordanchenko/actions/prune-package-json@v1
  with:
    prune: scripts.postinstall myField
    keep: scripts.prepare browserslist
```

## What gets deleted

**Fields** — the default list covers `devDependencies`, dev tool config blocks
(`eslintConfig`, `prettier`, `stylelint`, `jest`, `babel`, `browserslist`,
`size-limit`, `husky`, `lint-staged`, `nano-staged`, `simple-git-hooks`,
`commitlint`, `release`), dev environment pins (`packageManager`, `volta`), and
dependency controls that only apply at the workspace root (`overrides`,
`resolutions`, `pnpm`, `workspaces`).

Fields npm or consumers read — `files`, `publishConfig`, `engines`, `exports`,
`sideEffects`, and the like — are never touched.

**Scripts** are pruned by allowlist rather than wholesale: every script is
deleted except the ones npm itself may still run after this step — during
`npm publish` (`prepublishOnly`, `prepack`, `postpack`, `publish`,
`postpublish`) or on the consumer's machine at install time (`preinstall`,
`install`, `postinstall`). If nothing survives, the empty `scripts` object is
removed too.

`prepare` is deliberately not on the allowlist: its dominant use
(`"prepare": "husky"`) is dev-phase, and consumers installing from the registry
never run it. If your package builds via `prepare`, keep it with
`keep: scripts.prepare`.

## Inputs

| Input               | Default | Description                                    |
| ------------------- | ------- | ---------------------------------------------- |
| `prune`             |         | Extra paths to delete beyond the defaults      |
| `keep`              |         | Paths to spare from the default prune list     |
| `working-directory` | `.`     | Directory containing the `package.json`        |

Both `prune` and `keep` take space- or comma-separated paths and share the same
dotted-path notation: `myField` targets a top-level field, `scripts.postinstall`
a single script. `keep: scripts` (undotted) leaves all scripts untouched. When
the same path appears in both, delete wins.

There are no outputs; the step logs a notice listing what was deleted.

## Notes

The action needs `node` on `PATH` — a given in any workflow that publishes to
npm (GitHub-hosted runner images bundle Node.js, and release workflows run
`actions/setup-node` regardless). No package manager is required: the action
edits `package.json` directly, so it works the same under npm, pnpm, or yarn.

Pruning runs before `npm publish`, so deleted lifecycle scripts won't fire
during the publish either — that's the point for `"prepare": "husky"`, but it
also means a package that builds via a publish-time script must `keep` it.

Surviving publish-time scripts (`prepack` and friends) remain in the published
manifest as inert dead weight — the price of not breaking publish-time builds.
A survivor being abused for dev-phase work (e.g.
`"postinstall": "patch-package"`) can be force-deleted via
`prune: scripts.postinstall`.

The pruned manifest is a working-tree edit meant only for the tarball — don't
commit it back to your repository.

## License

MIT © 2026 [Igor Danchenko](https://github.com/igordanchenko)
