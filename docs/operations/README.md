# Launch Operations Runbook

This runbook is the safe starting point before launch-day changes, data imports, cleanup, or production verification.

## Operating principles

- Inspect first. Check `git status --short`, recent commits, and the target script before running anything.
- Prefer dry runs before writes. Use `--dry-run` first for imports and cleanup.
- Do not run destructive cleanup against production without reading the dry-run output and using `--confirm` intentionally.
- Do not commit `.env.local`, service account JSON files, mailbox passwords, Firebase private keys, or real `data/palacios-churches.json`.
- Leave unrelated untracked folders alone unless the owner confirms they should be removed.

## Standard launch-readiness dry run

Run these from the repo root:

```powershell
git status --short
npm.cmd run lint
npm.cmd run build
npm.cmd run import:palacios -- --input data/palacios-churches.example.json --dry-run
npm.cmd run cleanup:test-data -- --dry-run
npm.cmd run cleanup:demo-data -- --dry-run
```

Expected result:

- Lint passes with no warnings or errors.
- Production build completes.
- Palacios import reports records it would import without writing.
- Cleanup scripts print matched records and do not delete anything.

If a cleanup dry run fails with `Firebase Firestore is not configured`, fix local Firebase Admin
credentials before attempting a live cleanup. Common fixes:

- restore the service account JSON at the path configured in `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`
- remove the stale file path and set `FIREBASE_CLIENT_EMAIL` plus `FIREBASE_PRIVATE_KEY`
- use Firebase managed credentials in the deployed runtime instead of local files

## Real Palacios import flow

1. Create `data/palacios-churches.json` from `data/palacios-churches.example.json`.
2. Confirm every record has real church data and is not marked as test or demo content.
3. Run:

```powershell
npm.cmd run import:palacios -- --input data/palacios-churches.json --dry-run
```

4. Review duplicates and skipped records.
5. Only after review, run:

```powershell
npm.cmd run import:palacios -- --input data/palacios-churches.json --confirm
```

Use `--overwrite` only when intentionally replacing existing church records.

## Cleanup flow

Always start with dry run:

```powershell
npm.cmd run cleanup:test-data -- --dry-run
npm.cmd run cleanup:demo-data -- --dry-run
```

Only run confirmed cleanup if the dry-run output matches what should be removed:

```powershell
npm.cmd run cleanup:test-data -- --confirm
npm.cmd run cleanup:demo-data -- --confirm
```

Never run cleanup blindly against production.

## Email and scheduled job checks

- `npm.cmd run test:email` is safe by default when `ALLOW_REAL_EMAIL_TEST=false`.
- Live email tests require `ALLOW_REAL_EMAIL_TEST=true` and should only send to an approved internal inbox.
- The annual listing verification workflow requires the same `LISTING_VERIFICATION_CRON_SECRET` value in both GitHub Actions secrets and the deployed app environment.
- If the workflow returns `401 Unauthorized`, verify the secret value in both places.

## Deployment checks

- GitHub Actions build validation should pass after pushing to `main`.
- Firebase App Hosting should deploy automatically from `main`.
- Confirm production environment variables in Firebase App Hosting before assuming runtime behavior.
- Confirm Firebase Auth authorized domains include the live domain.

## Minimum post-deploy smoke check

Open these routes after deployment:

- `/`
- `/churches`
- `/submit`
- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/listing-guidelines`
- `/admin/login`
- `/portal/login`

Then test one real church profile and its claim route.

## What to automate next

- A single `npm run ops:launch-check` command that runs lint, build, import dry run, cleanup dry runs, and writes a timestamped log.
- A GitHub Actions workflow that runs the same launch-readiness dry run on demand.
- A non-destructive Firebase data audit that counts published, pending, archived, claimed, unclaimed, test-looking, and demo-looking records.
- A visual smoke test for the public pages and auth pages using browser automation.
- A scheduled report that confirms annual listing verification ran successfully and logs the number of reminders sent.
