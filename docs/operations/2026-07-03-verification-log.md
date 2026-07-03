# Verification Log - 2026-07-03

This log records the launch-readiness checks run during the operations pass.

## Repository inspection

- Command: `git status --short`
- Result before documentation changes: only `.claude/` was untracked.
- Action: left `.claude/` untouched because it is unrelated local tooling state.

## Configuration inspection

- Confirmed `.env.example` includes site, Firebase client, Firebase admin, email, admin seed, test email, and emulator groups.
- Confirmed `.gitignore` excludes `.env.local`, service account JSON files, `storage/uploads/*`, and `data/palacios-churches.json`.
- Confirmed GitHub build validation workflow uses `actions/checkout@v5`, `actions/setup-node@v5`, and Node `22`.
- Confirmed annual listing verification workflow requires `LISTING_VERIFICATION_CRON_SECRET`.

## Dry-run manifest

- Created `docs/operations/2026-07-03-dry-run-manifest.md`.
- Created `docs/operations/README.md`.
- Added README links to the operations runbook and dry-run manifest.

## Verification commands

Results below were filled in during the final verification pass.

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run lint` | Passed | No ESLint warnings or errors. Next.js printed the expected `next lint` deprecation notice. |
| `npm.cmd run build` | Passed | Initial run failed because local `.env.local` pointed to a missing Firebase service account JSON file. Added a build-only guard so protected pages can prerender without live Admin credentials. Final build passed. |
| `npm.cmd run import:palacios -- --input data/palacios-churches.example.json --dry-run` | Passed | Parsed 1 example church and wrote no records. Local Firebase service account file warning still appears because `.env.local` points to a missing JSON path. |
| `npm.cmd run cleanup:test-data -- --dry-run` | Blocked locally | Failed safely before touching data because Firebase Admin credentials were not configured locally. Error: `Firebase Firestore is not configured.` |
| `npm.cmd run cleanup:demo-data -- --dry-run` | Blocked locally | Failed safely before touching data because Firebase Admin credentials were not configured locally. Error: `Firebase Firestore is not configured.` |
| `git diff --check` | Passed | No whitespace errors. Git reported normal LF-to-CRLF working-copy warnings on Windows. |

## Implementation changes made

- Added an operations runbook at `docs/operations/README.md`.
- Added this dated verification log.
- Added a dated dry-run manifest.
- Linked the operations docs from the main `README.md`.
- Updated Firebase Admin initialization so missing local Admin credentials do not crash Next.js production build prerendering. Runtime production still requires credentials.
- Reduced duplicate missing-service-account warnings within each process.

## Launch-readiness notes

- The app builds successfully after the Firebase Admin build guard.
- Local cleanup verification cannot complete until the stale `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` is fixed or replaced with environment-based Admin credentials.
- No destructive cleanup or live import commands were run.

## Follow-up automation candidates

- Add `npm run ops:launch-check`.
- Add on-demand GitHub Actions launch-readiness workflow.
- Add Firebase data audit counts.
- Add public route visual smoke checks.
- Add annual verification success/failure summary reporting.
