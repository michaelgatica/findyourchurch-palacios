# Community Ministry Hub Production Deployment Plan

Prepared July 14, 2026. This is a plan only. No production merge, deployment, data write, rules/index release, secret change, scheduler change, SMTP change, DNS change, or sitemap submission was performed.

## Release Gate

The current certification recommendation is **NO-GO** until the blocking conditions in `docs/community-ministry-hub-security-acceptance.md` are resolved. A deployment operator must not treat a merged branch, passing build, or staging rollout as launch authorization.

Required approvals:

- Launch owner approves the release window and final requirement traceability.
- Launch owner and platform technical owner accept or remediate the 11 moderate dependency advisory nodes.
- Ministry operations owner certifies provider-backed SMTP delivery and production sender/DNS readiness.
- Accessibility/QA owner completes or accepts the native screen-reader gap; Playwright WebKit already passes, while native Safari hardware remains optional unless the owner elevates it.
- Operations/privacy owners approve monitoring, alert recipients, backups, Storage recovery, and log-retention policy.
- A second operator verifies the production project, database, bucket, backend, and canonical hostname before every external write.

## Canonical Host And Redirect Policy

The intended production canonical origin is `https://findyourchurchpalacios.org` using HTTPS and the non-`www` host. This is a release decision, not a claim that DNS, TLS, App Hosting domain mapping, or redirects are active.

After the domain is actually configured:

- Redirect `http://findyourchurchpalacios.org/*` permanently to the same path/query on `https://findyourchurchpalacios.org/*`.
- Redirect `https://www.findyourchurchpalacios.org/*` permanently to the non-`www` HTTPS host.
- Redirect Firebase/App Hosting default domains to the canonical host when the hosting platform supports the mapping without breaking health checks.
- Preserve the legacy `/churches/{churchSlug}` route as a permanent redirect to `/{state}/{city}/{churchSlug}`.
- Preserve legacy claim paths and redirect to the matching canonical claim path.
- Redirect any duplicate event route to the single `/events/{eventSlug}` path.
- Do not configure or claim `findyourchurch.org` for this launch unless it is separately verified and approved.

Staging must continue to use its own hosted URL, staging canonical values, and global `noindex`; it must never claim the production origin.

## Production Firebase And Hosting Identifiers

The repository currently documents production project `findyourchurch-24562` and Firestore database `findyourchurchpal`. The production bucket, App Hosting backend, app ID, and exact domain mapping must be read from the approved production console immediately before deployment. Do not infer them from staging or from old documentation.

Every external command must provide an explicit production project/configuration after approval. Abort if the CLI-selected project, command `--project`, App Hosting backend, database, or bucket disagree.

## Required Environment Variables

Non-secret production values:

- `APP_ENV=production`.
- `NEXT_PUBLIC_APP_ENV=production`.
- `NEXT_PUBLIC_SITE_URL=https://findyourchurchpalacios.org`.
- `NEXT_PUBLIC_ACTIVE_MARKET_KEY=palacios`.
- `NEXT_PUBLIC_ENABLE_DONATIONS` and the approved donation target/path.
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`.
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.
- `NEXT_PUBLIC_FIREBASE_APP_ID`.
- `NEXT_PUBLIC_FIREBASE_DATABASE_ID=findyourchurchpal`.
- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`.
- `FIREBASE_PROJECT_ID`.
- `FIREBASE_STORAGE_BUCKET`.
- `FIREBASE_DATABASE_ID=findyourchurchpal`.
- `PRODUCTION_FIREBASE_PROJECT_ID` matching the approved production project.
- `EMAIL_PROVIDER=smtp` or the approved supported provider.
- `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, and optional approved `SMTP_REPLY_TO`.
- `SMTP_HOST` and `SMTP_PORT` when SMTP is used.
- `RETENTION_JOB_ENABLED=true` only after the cleanup schedule and retention policy are approved.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` only when approved.
- `APP_CHECK_SITE_KEY` when the App Check rollout is approved.

## Required Secrets

Store secrets only in the production provider's secret manager. Use production-specific names and versions; never reuse the staging values.

- Firebase client API key if managed as an App Hosting build/runtime secret.
- `REGISTRATION_TOKEN_SECRET`.
- `EXPORT_SIGNING_SECRET`.
- `REGISTRATION_JOBS_CRON_SECRET`.
- `LISTING_VERIFICATION_CRON_SECRET` if the existing listing-verification job is enabled.
- `SMTP_USER` and `SMTP_PASSWORD`, or `RESEND_API_KEY` for the approved alternative.
- `ERROR_MONITORING_DSN` when the monitoring provider requires a secret value.
- Any explicit Firebase Admin private credential only if managed identity cannot be used. Prefer the App Hosting service account; do not upload a service-account JSON without a reviewed need.

Before deploy, verify secret bindings and service-account access by name/version only. Do not print secret values.

## Firestore Collections And Storage Paths

New Community Ministry Hub collections:

- `events` and sanitized `publicEvents`.
- `eventCategories` and `eventReports`.
- `eventRegistrations`.
- `eventRegistrationConfigurations` and `eventFormVersions`.
- `eventRegistrationCounters` and `eventRegistrationConfirmations`.
- `eventRegistrationTokens`, `eventRegistrationIdempotency`, and `eventRegistrationRateLimits`.
- `eventExports`.
- `eventScheduledJobs` and `operationalLocks`.
- `operationalEvents`.

New Storage paths:

- Public, non-listable flyers: `churches/{churchId}/events/{eventId}/flyer/{fileName}`.
- Private server-only exports: `private/event-exports/{churchId}/{eventId}/{fileName}`.

All writes to these paths are trusted-server operations. Do not enable direct browser writes for launch.

## Required Indexes

Deploy the 25 composite indexes in `firestore.indexes.json` to the approved production database and wait until every required index is `READY` before deploying queries that need it.

Coverage includes:

- Four `publicEvents` status/visibility/was-published/start-date and church-scoped combinations.
- Three event dashboard status/type/date combinations plus audience-tag/date query.
- Category group/sort and report status/date queries.
- Event form version query.
- Twelve registration event/status/name-prefix/search-prefix/date/order combinations.
- Two scheduled-job due/event-status combinations.
- Operational-event severity/date query.

Do not add speculative indexes in the deployment window. Add only an index required by an actual application query, verify it in staging, and update the committed file first.

## Required Scheduler Jobs

Community Hub dispatcher:

- Endpoint: `POST /api/jobs/registration`.
- Recommended starting cadence: every 15 minutes.
- Time zone: `America/Chicago`.
- Authentication: production-only `REGISTRATION_JOBS_CRON_SECRET` in the expected private header or an approved stronger service identity that the route supports.
- Environment guard: production marker must match the production application.
- Jobs dispatched: closing report, pre-event report, daily digest, event reminder/fan-out notice, export/token cleanup, and registration-retention cleanup.
- Alert if two consecutive invocations fail or no successful completion appears for 45 minutes.

Existing listing verification, if retained:

- Endpoint: `POST /api/jobs/listing-verifications`.
- Use a separate `LISTING_VERIFICATION_CRON_SECRET` and preserve its existing schedule/ownership.
- Do not replace or delete this existing workflow as part of the Community Hub launch.

Create jobs paused, validate configuration, invoke once with controlled records, then enable only after application and secrets are ready.

## SMTP And DNS Work

Before production:

- Select SMTP or the supported provider and record the operations owner.
- Verify the exact `EMAIL_FROM`, optional reply-to, administrator-recipient list, and provider credential binding.
- Configure and verify SPF and DKIM for the sender domain; approve DMARC policy/monitoring and return-path/bounce handling.
- Ensure links generated in registration, management, reminder, report, claim, update, and listing-verification email use the production canonical origin.
- Send one controlled registration confirmation, one church-administrator notification, and one small PDF/XLSX report to approved recipients.
- Verify sender/reply-to, mailbox receipt, attachment integrity, provider message ID, staging/production link correctness, redaction, and bounce/failure recording.
- Never use church or registrant production addresses for the deployment test without explicit approval.

## Exact Deployment Order And Rollback Gates

1. **Confirm launch approval.** Verify the signed GO record. Rollback gate: if approval is absent or ambiguous, stop before any external write.
2. **Confirm risk acceptance.** Attach the dependency, App Check, accessibility/browser, monitoring, backup, retention, and SMTP decisions. Rollback gate: unresolved blocking risk means stop.
3. **Schedule the deployment window.** Name incident commander, operator, reviewer, ministry operations contact, and observation window. Rollback gate: missing coverage means reschedule.
4. **Back up Firestore.** Complete and record the managed backup/export. Rollback gate: failed/unreadable backup means stop.
5. **Confirm Storage backup considerations.** Record versioning/soft-delete/retention and recovery expectations for flyers/exports. Rollback gate: unknown recovery ownership means stop.
6. **Verify production secrets.** Confirm names, versions, service-account access, and staging/prod separation without printing values. Rollback gate: missing or shared staging secret means stop and rotate.
7. **Verify the canonical domain.** Confirm DNS, TLS, App Hosting mapping, HTTPS, non-`www`, default-domain, legacy, and duplicate-route policies. Rollback gate: incorrect domain mapping means keep old site serving.
8. **Verify SMTP domain.** Confirm provider, SPF, DKIM, DMARC decision, sender, reply-to, bounce path, and controlled recipients. Rollback gate: failed domain/provider check means keep email disabled.
9. **Verify scheduler configuration.** Prepare paused jobs, endpoint, cadence, time zone, secret/service identity, and alert ownership. Rollback gate: missing auth/alerts means do not enable.
10. **Deploy Firestore indexes.** Target only the approved production project/database. Rollback gate: command target mismatch means abort; index creation itself is additive and normally left in place on application rollback.
11. **Wait for indexes to become ready.** Confirm all 25 required composite indexes report ready. Rollback gate: failed/stuck required index means stop before application deployment.
12. **Deploy Firestore rules.** Reconfirm project/database and deploy the reviewed rules only. Rollback gate: immediately run public/admin rules probes; restore the prior rules if existing reads break or data becomes overexposed.
13. **Deploy Storage rules.** Reconfirm project/bucket and deploy reviewed rules only. Rollback gate: run public flyer/private export/cross-church probes; restore prior secure rules or close file workflows on failure.
14. **Deploy server application or functions.** Deploy the approved backend revision with production environment bindings. Rollback gate: on config validation, startup, auth, or data-access failure, send traffic to the previous compatible revision and keep registrations/email/jobs paused.
15. **Deploy hosting.** Attach the approved canonical domain and redirects without changing unrelated production sites. Rollback gate: restore previous hosting revision/domain mapping if homepage/directory/legacy routes fail.
16. **Configure App Check.** Apply the approved enforcement or monitor-first plan. Rollback gate: if valid clients are blocked, revert to the approved monitoring state—not an undocumented disabled state.
17. **Configure SMTP.** Bind the approved provider and sender configuration but keep broad outbound automation paused. Rollback gate: provider/config validation failure returns email to non-delivering mode.
18. **Configure Cloud Scheduler.** Create/update jobs in paused state and verify auth. Rollback gate: unauthorized response, wrong environment, or unexpected duplicate means keep jobs paused and rotate the secret if needed.
19. **Run public smoke tests.** Use controlled routes/records. Rollback gate: homepage, directory, church, event, flyer, registration privacy, canonical, robots, or sitemap failure restores prior application/hosting.
20. **Run representative smoke tests.** Verify sign-in, church scope, existing event, registration, flyer, PDF/XLSX, and cross-church denial. Rollback gate: any isolation failure immediately closes registrations and restores the prior release/rules.
21. **Run platform-admin smoke tests.** Verify events, reports, categories, operations, and ordinary-representative denial. Rollback gate: admin lockout pauses launch; privilege expansion triggers immediate rollback.
22. **Test one controlled registration.** Confirm capacity/counters/idempotency and cancel/remove the controlled record through the supported process. Rollback gate: oversubscription, duplication, or counter drift closes registrations and rolls back.
23. **Test one controlled email.** Confirm sender, production links, redaction, logs, and receipt. Rollback gate: keep email disabled and do not open registrations that require confirmations.
24. **Test one scheduler invocation.** Invoke the paused job manually with controlled work, repeat it, and confirm no duplicate. Rollback gate: keep Scheduler paused on auth/idempotency/log failure.
25. **Verify monitoring.** Confirm alert delivery, dashboards/logs, owners, and manual fallbacks. Rollback gate: no alert path means do not open registrations.
26. **Open registrations.** Enable only approved events in a small controlled sequence. Rollback gate: rising failures/counter inconsistency closes affected registrations first, then rolls back if systemic.
27. **Submit sitemap.** Submit only after canonical host, robots, sitemap exclusions, and production domain are verified. Rollback gate: remove/correct submission if private/unlisted/tokenized routes appear.
28. **Begin post-launch observation.** Staff the agreed window and review registration, email, scheduler, export, auth-denial, Storage, and configuration signals. Rollback gate: use the trigger table in the rollback runbook.

## Post-Deployment Controlled Smoke Checklist

- [ ] Homepage loads on canonical HTTPS with no production/staging confusion.
- [ ] Directory count and filters match published churches.
- [ ] Canonical church page and legacy redirect work.
- [ ] Events listing excludes draft/unlisted/private records.
- [ ] Published/cancelled event detail and flyer work; missing flyer falls back.
- [ ] Representative signs in with the controlled account and sees only its church.
- [ ] Representative creates one controlled draft event and removes/archives it through the approved cleanup path.
- [ ] One controlled registration confirms capacity, counter, confirmation page, and management link.
- [ ] Confirmation email arrives with correct sender and canonical production links.
- [ ] Registration dashboard and detail show only the controlled church/event.
- [ ] Controlled PDF and XLSX exports generate, download privately, escape formulas, and expire.
- [ ] Platform admin opens events, moderation, category management, and operations readiness.
- [ ] Ordinary representative remains denied from platform-admin routes.
- [ ] One authorized scheduler invocation succeeds; unauthorized and duplicate invocations fail safely.
- [ ] Monitoring receives/records controlled success and failure evidence without sensitive payloads.

Use only controlled test records. Do not use real registrant, child, medical, allergy, emergency-contact, or complete-address data in deployment smoke tests.
