# Community Ministry Hub Rollback And Recovery

This runbook explains how to recover from a failed Community Ministry Hub release without deleting production church, event, or registration data.

## Rollback Principles

- Preserve Firestore registration records, counters, tokens, exports, audit logs, and email logs.
- Prefer disabling schedulers or registrations over deleting records.
- Roll back application code before changing data.
- Never run destructive recovery against production without a verified backup and launch-owner approval.

## Backup Checklist

- Firestore managed backup or export configured.
- Storage bucket backup/retention reviewed.
- Current `firestore.rules` and `storage.rules` saved in git.
- Current `firestore.indexes.json` saved in git.
- Environment-variable names exported to a secure password manager or hosting config backup.
- SMTP settings recorded without exposing passwords in docs.
- Scheduler endpoints, secrets, and timing recorded.
- Current application release/commit recorded.

## Immediate Rollback Steps

1. Disable scheduler calls to `/api/jobs/registration`.
2. Pause new internal registrations if duplicate sends, capacity bugs, or export issues are suspected.
3. Redeploy the previous known-good application release.
4. Keep Firestore data intact.
5. Keep Storage export/flyer files intact unless a private file exposure is confirmed.
6. Confirm public church directory and public church pages still work.
7. Confirm existing event/registration data remains readable to authorized admins.

## Disable New Registrations

Use the safest available option:

- Change affected events to `registration.mode = none` or an external registration mode.
- Close registration through event registration settings.
- Temporarily hide internal registration CTA if a code rollback is needed.

Do not delete registration records to pause activity.

## Disable Report Emails

- Disable scheduler first.
- Disable scheduled report settings on affected events if necessary.
- Keep manual export download available only if export security is verified.

## Secret Rotation

If `REGISTRATION_TOKEN_SECRET` is compromised:

- Rotate the secret.
- Treat existing management links as revoked.
- Notify affected registrants if production links were exposed.

If `EXPORT_SIGNING_SECRET` or export access is compromised:

- Delete unexpired private export files.
- Delete corresponding export records.
- Rotate the secret.
- Regenerate exports only after authorization is verified.

If `REGISTRATION_JOBS_CRON_SECRET` is compromised:

- Rotate scheduler secret in app and scheduler.
- Review unauthorized scheduler attempts.

## Registration Count Recovery

If aggregate counters drift:

1. Query registrations by event.
2. Recalculate submitted, confirmed, waitlisted, cancelled, checked-in, attended, no-show, confirmed attendees, and waitlisted attendees.
3. Update the event counter document through a controlled admin script.
4. Record an audit entry.

Do not manually edit counters without preserving the recalculation evidence.

## Nonproduction Rollback Exercise

Safe staging exercise:

1. Record current staging release.
2. Seed staging data using `npm run seed:community-hub-staging -- --confirm`.
3. Deploy or run a previous staging revision.
4. Confirm public event data remains intact.
5. Restore current staging revision.
6. Confirm registrations remain intact.
7. Confirm rules and indexes remain compatible.
8. Reset staging with `npm run reset:community-hub-staging -- --confirm`.

Status for this phase:

- Not executed because no staging project or preview deployment credentials were provided.
- Local rollback procedure is documented but cannot satisfy full GO by itself.

## Recovery Ownership

- Launch owner: approves rollback and production data recovery.
- Technical owner: executes deploy/rules/index/scheduler rollback.
- Ministry operations owner: sends church/registrant communication if needed.
