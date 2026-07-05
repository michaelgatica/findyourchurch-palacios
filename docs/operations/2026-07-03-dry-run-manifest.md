# Dry-Run Manifest - 2026-07-03

Purpose: document the non-destructive launch-readiness checks to run before any production-affecting operation.

## Scope

- Inspect repository state.
- Verify TypeScript/Next.js build health.
- Verify Palacios import schema with example data.
- Verify cleanup scripts can preview matched records without deleting data.
- Produce a durable log of what was run and what happened.

## Non-destructive commands

```powershell
git status --short
npm.cmd run lint
npm.cmd run build
npm.cmd run import:palacios -- --input data/palacios-churches.example.json --dry-run
npm.cmd run cleanup:test-data -- --dry-run
npm.cmd run cleanup:demo-data -- --dry-run
git diff --check
```

## Destructive commands intentionally excluded

These commands are not part of this manifest unless the dry-run output is reviewed and approved:

```powershell
npm.cmd run import:palacios -- --input data/palacios-churches.json --confirm
npm.cmd run import:palacios -- --input data/palacios-churches.json --confirm --overwrite
npm.cmd run cleanup:test-data -- --confirm
npm.cmd run cleanup:demo-data -- --confirm
```

## Safety notes

- `data/palacios-churches.json` is gitignored and should contain real data only when preparing import.
- `.env.local` is gitignored and must remain uncommitted.
- Untracked local assistant/tooling folders are unrelated to launch operations.
- Cleanup scripts require `--dry-run` or `--confirm`; they refuse to run without one of those flags.

## Expected outcomes

- Lint passes.
- Build passes.
- Import dry run parses the example data and writes nothing.
- Cleanup dry runs print what would be removed and write nothing.
- No secrets are printed.
