# Community Ministry Hub Backup, Rollback, And Recovery

Certification date: July 14, 2026

This runbook preserves church, event, and registration records during a failed release. It does not authorize a production rollback by itself. Production actions require launch approval, a verified target project/database/bucket, a named incident commander, and a verified backup.

## Recovery Principles

- Stop the harmful write or outbound action before changing application data.
- Prefer pausing schedulers, closing registrations, disabling email, or rolling back application code over deleting records.
- Preserve Firestore registrations, counters, confirmations, token hashes, exports, jobs, audit logs, email logs, and operational logs.
- Preserve Storage flyers unless the files themselves are unsafe. Revoke or delete private exports if link or signing security is in doubt.
- Deploy only a schema-compatible prior release. Never roll back rules below what the retained data requires.
- Record each command, project ID, database ID, bucket, release, operator, timestamp, and result in the private incident record.

## Historical Backup Readiness Before Blocker Closure

Staging evidence collected July 14, 2026:

- Firebase project: `findyourchurch-staging-2026`.
- Firestore database: `findyourchurchpal`.
- `firebase firestore:backups:schedules:list` returned no managed backup schedules.
- Storage bucket: `findyourchurch-staging-2026.firebasestorage.app`.
- Bucket versioning, retention policy, and soft-delete duration were not reported as enabled by the available metadata query.
- Rules and index definitions are versioned in `firestore.rules`, `storage.rules`, and `firestore.indexes.json`.
- Staging App Hosting secrets exist by name for the Firebase API key, registration-token secret, export-signing secret, scheduler token, and QA password. Values were not printed or copied.
- Provider-backed SMTP is not configured in staging; outbound staging email remains paused with `EMAIL_PROVIDER=console`.

Production implication: backup and Storage-protection settings are **not certified by staging**. Before the first production write, the operations owner must confirm a production Firestore managed-backup/export strategy, Storage recovery expectations, retention/soft-delete/versioning choices, restore permissions, destination location, RPO, and RTO.

## Current Staging Backup And Recovery Evidence

The blocker-closure pass supersedes the historical snapshot above:

- Daily Firestore managed-backup schedule: 14-day retention.
- Weekly Sunday Firestore managed-backup schedule: 12-week retention.
- All schedules target only `findyourchurch-staging-2026` / database `findyourchurchpal`.
- No first managed backup existed at the verification checkpoint, so managed Firestore restore is not marked passed.
- Bucket `findyourchurch-staging-2026.firebasestorage.app` has seven-day soft delete; object versioning and a bucket retention lock are intentionally disabled.
- Safe Storage recovery passed by deleting and restoring one fictitious object and comparing its size/content hash.
- Operational TTL is `ACTIVE` for `auditLogs`, `emailLogs`, `eventScheduledJobs`, and `operationalEvents` on field `retentionExpiresAt`.
- 605 historical staging records received TTL values: 307 audit, 87 email, 1 terminal Scheduler job, and 210 operational events.

Production remains gated on creating the same schedules/protection against verified production identifiers, recording a completed backup, proving restore permissions, and performing a non-destructive restore/clone check. Do not use staging data as a production backup.

## Production Recovery Preflight — July 14, 2026

- Production `findyourchurchpal` has point-in-time recovery and delete protection enabled.
- Managed schedules are daily/14-day and Sunday-weekly/84-day in `nam5`.
- No first scheduled backup existed at the final poll; managed-backup restore remains unverified.
- A production PITR clone completed successfully in an isolated `recovery-*` database. Representative `churches` and `locations` documents were present in source and recovery with matching document identity and field counts (57 and 10 fields). The temporary recovery database was removed after its inherited delete protection was disabled; source delete protection remained enabled.
- Production Storage seven-day soft delete is active. The safe object delete/restore/checksum exercise passed and left no live validation object.
- Source database delete protection remained enabled after recovery cleanup.

The first managed backup must still be restored into a new recovery database when it appears. Verify representative church records, index metadata, and collection inventory, then remove only the recovery database after a second identifier check. A successful PITR clone does not substitute for the required managed-backup restore.

Later on July 14, the remediation revision was deployed and App Check was enforced only after a valid production token exchange. If legitimate Authentication, Firestore, or Storage clients begin receiving App Check rejections, the rollback operator may return the affected service to `UNENFORCED` while preserving Authentication and Security Rules, then investigate the served revision and provider configuration. Record that downgrade as an incident; do not silently leave enforcement disabled.

Production SMTP now uses the versioned `FYC_PROD_SMTP_PASSWORD` Secret Manager binding. A controlled delivery and mailbox receipt passed. To pause email, change the provider to the approved non-delivering mode or stop the calling job/action; do not delete the secret version during an incident. The credential-rotation waiver does not prevent emergency rotation if compromise is suspected.

The first managed backup still had not appeared at the latest poll. Until its isolated restore passes, the release gate remains closed even though PITR, delete protection, schedules, and Storage soft-delete recovery are active.

## Pre-Deployment Backup Checklist

- [ ] Record production project, database, Storage bucket, App Hosting backend, release commit, and current serving revision.
- [ ] Confirm the active CLI target equals the production project approved for the deployment window; obtain a second-person check before each external write.
- [ ] Confirm a recent Firestore managed backup or export is complete and readable by the recovery operator.
- [ ] Record backup name, database, location, completion time, retention, and restore procedure in the private change record.
- [ ] Decide and record Storage versioning, soft delete, retention, and flyer/private-export recovery expectations.
- [ ] Save the exact committed `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, and App Hosting configuration used for release.
- [ ] Inventory environment-variable and secret **names and versions** without copying values into Git or tickets.
- [ ] Record SMTP provider, sender domain, reply-to, administrator-recipient configuration, and private credential owner.
- [ ] Record scheduler job names, regions, schedules, time zones, endpoint paths, service identity/header names, and secret-version owner.
- [ ] Confirm the previous application release remains buildable and compatible with current Firestore documents and indexes.
- [ ] Confirm the operator can pause Scheduler, set email to a non-delivering provider, close registrations, revoke exports, and rotate token secrets.

## Environment And Secret Recovery Inventory

Store values only in the approved secret manager/password manager. The recovery inventory must include:

- Firebase client key and app identifiers.
- Firebase Admin project, database, bucket, service identity, and any explicit service-account binding.
- `REGISTRATION_TOKEN_SECRET`.
- `EXPORT_SIGNING_SECRET`.
- `REGISTRATION_JOBS_CRON_SECRET`.
- `LISTING_VERIFICATION_CRON_SECRET` if the existing listing-verification job remains active.
- SMTP password or `RESEND_API_KEY`, plus non-secret email provider/from/reply-to/administrator-recipient configuration.
- App Check provider/site configuration.
- Monitoring DSN and alert destination configuration.
- Canonical URL, donation enablement/target, analytics, and site-verification values.

Secret values must not appear in source, screenshots, terminal transcripts, email, or the incident timeline.

## Staging Rollback Exercise

The safe staging exercise was completed July 14, 2026. Only the App Hosting backend was deployed; Firestore rules, Storage rules, indexes, data, secrets, and production were not changed.

| Step | Evidence | Result |
| --- | --- | --- |
| Record current release | Commit `8c0263274805d0e2818ee90e65c1fd76775c22de`, serving revision `community-hub-staging-build-2026-07-14-011` | Pass |
| Preserve data baseline | 3 churches, 131 events, 119 public projections, 1,125 registrations, 13 management-token records, 39 export records, 2 scheduled jobs, 119 operational events | Pass |
| Roll back application | Compatible prior commit `1d5049b743ef4c5b49bcbe53d489c68beac4353e` deployed to staging revision `...-012` | Pass |
| Verify public data | Hosted smoke suite passed homepage, directory, published/draft/unlisted/cancelled, missing-flyer, and invalid-token behavior | Pass |
| Verify registrations/admin | Read-only hosted dataset and authenticated pagination checks passed; 500-record dashboard loaded | Pass |
| Recheck prior-release counts | All eight collection counts matched the baseline exactly | Pass |
| Restore latest release | Commit `8c026327...` restored as revision `...-013` with 100% traffic | Pass |
| Recheck current workflows | Hosted public smoke and authenticated dataset/pagination checks passed | Pass |
| Recheck data | Core counts remained 3/131/119/1,125/13/39/2; operational events became 121 because the normal 15-minute scheduler wrote one start and one completion record during the exercise | Pass; expected audited change |
| Pause controls | Scheduler job `community-hub-registration-jobs-staging` transitioned `ENABLED -> PAUSED -> ENABLED`; outbound staging email remained disabled through `EMAIL_PROVIDER=console` | Pass |

The exercise demonstrates application rollback compatibility across the latest two releases and preservation of the current Firestore schema. It does not substitute for a production backup/restore drill.

## Rollback Triggers

Immediately stop or roll back when any of the following is confirmed:

- Cross-church registration, event, or Storage access.
- Public exposure of registration answers, private exports, management tokens, export tokens, secrets, or never-published events.
- Capacity oversubscription or counter drift that affects acceptance/waitlist status.
- Duplicate transactional emails or scheduler deliveries caused by loss of idempotency.
- Sustained registration failure above 10% for 15 minutes with at least 20 attempts.
- Repeated SMTP or scheduler failure beyond the alert thresholds.
- Rules/index deployment that blocks existing church directory, representative, or admin workflows.
- Canonical/robots/sitemap behavior that exposes private routes or incorrectly claims a production domain.
- Configuration validation failure or environment/project mismatch.
- Irrecoverable application errors on homepage, directory, event detail, registration, representative portal, or admin operations.

## Immediate Containment

1. Declare the incident and record the time, production identifiers, active revision, and observed trigger.
2. Pause Cloud Scheduler jobs that call `/api/jobs/registration` and `/api/jobs/listing-verifications` as applicable.
3. Disable outbound email by changing the production provider to the approved non-delivering mode or removing the dispatcher schedule; do not expose or overwrite SMTP credentials in a rushed edit.
4. Close affected event registrations through event configuration. If the failure is global, deploy the approved registration-closed feature flag/configuration or compatible rollback release.
5. Revoke private export access by deleting affected export records/files and rotating `EXPORT_SIGNING_SECRET` when compromise is possible.
6. Rotate `REGISTRATION_TOKEN_SECRET` if management tokens may be compromised; treat all prior management links as revoked.
7. Rotate `REGISTRATION_JOBS_CRON_SECRET` and update both application and Scheduler atomically if scheduler authentication may be compromised.
8. Preserve logs and data. Do not reset, reseed, bulk-delete, or edit counters manually.

## Application Rollback

1. Identify the previous known-good, schema-compatible commit and its configuration/rules/index contract.
2. Confirm Firestore data created by the newer release remains readable and will not be deleted or rewritten by the older release.
3. Deploy only the application/backend/hosting portion first.
4. Verify the serving revision and 100% traffic assignment.
5. Run controlled public smoke checks for homepage, directory, church page, events, event detail, and flyer.
6. Run authenticated representative checks for existing event and registration read access without creating broad test data.
7. Run platform-admin operations/readiness checks.
8. Keep registrations/email/schedulers paused until the incident trigger is resolved and counts are consistent.

Rules rollback is separate and higher risk. Roll back Firestore or Storage rules only when the current rules cause the incident and the prior rules are proven compatible with current data. Never reintroduce public registration reads, direct browser writes, unlisted listing access, or private-export reads.

## Data Migration And Backfill Rollback

The current Community Ministry Hub range is additive. It introduces new collections, projections, counters, token hashes, export/job records, indexes, and Storage paths, but no destructive production migration or required existing-church backfill is defined.

- Do not delete additive documents merely because application code is rolled back.
- Preserve `events`, `publicEvents`, registration collections, jobs, logs, and Storage files for forward recovery.
- If a future migration changes document shape, it must ship with a versioned dry run, backup, idempotent forward migration, and tested compensating rollback before deployment approval.
- If a backfill is required later, record every touched document ID and support resume/retry without duplicate writes.

## Registration And Event Preservation

- Close registrations by configuration; never delete registrations to stop intake.
- Cancel or archive a published event rather than deleting it. Only never-published drafts may be deleted through the supported workflow.
- Preserve confirmation numbers, counters, waitlist order, and audit records.
- Preserve flyer objects unless a file is unsafe or exposes private data.
- Keep scheduled jobs paused until event/registration state is reconciled.

## Aggregate Count Recovery

If counters drift:

1. Keep registrations closed and scheduler/email paused for the affected event.
2. Query registrations only for that church/event in bounded pages.
3. Recalculate submitted, confirmed, waitlisted, cancelled, checked-in, attended, no-show, confirmed-attendee, and waitlisted-attendee totals.
4. Compare calculated totals with `eventRegistrationCounters` and document the delta.
5. Apply a controlled, reviewed server-side repair script to the single counter record.
6. Write an audit record containing identifiers and before/after counts, not registration answers.
7. Re-run capacity, waitlist, registration dashboard, export total, and idempotency checks before reopening.

## Restore From Backup

Use managed Firestore restore/clone/export procedures appropriate to the approved production backup. Restore into a separate recovery database/project first when practical. Validate collection counts, a representative sample of church/event/registration documents, rules compatibility, indexes, and Storage references before any cutover.

Never restore staging data into production. Never restore a backup without confirming database ID and timestamp. A restore that overwrites newer registrations requires explicit incident-commander and ministry-operations approval plus a reconciliation plan for records accepted after the backup.

## Recovery Exit Criteria

- Root cause and affected interval are recorded.
- Public, representative, and admin controlled smoke checks pass.
- Registration/capacity/waitlist aggregates reconcile.
- Private exports and tokens are safe or rotated/revoked.
- Email and scheduler idempotency checks pass before resuming.
- Monitoring is green and the next observation window is assigned.
- The incident commander and ministry operations owner explicitly approve reopening registrations and outbound email.
