# Community Ministry Hub Launch Readiness

This document covers the controlled launch-readiness pass for Community Ministry Hub events and registration. It is intentionally operational: it tells a platform administrator what exists, what still needs staging or production verification, and how to roll back safely.

## Branch Baseline

- Registration base commit: `5d67e21`.
- Launch-readiness branch: `feature/community-ministry-hub-launch-readiness`.
- Production deployment: not performed in this phase.
- Production data mutation: not performed in this phase.

## Implementation Audit

Production-ready code paths:

- Public `/events` listing and `/events/[eventSlug]` detail pages read sanitized `publicEvents`.
- Church representatives create and manage events through trusted server actions.
- Internal registration forms, capacity, waitlist, idempotency, secure management tokens, exports, scheduled jobs, and email templates are implemented server-side.
- Firestore and Storage rules deny direct browser writes to event, registration, export, job, token, and audit records.
- Private registration exports are served through an authorized API route, not direct public Storage reads.

Intentionally development-only:

- `EMAIL_PROVIDER=console`.
- Local emulator tests using `demo-find-your-church`.
- Seed/sample scripts when explicitly run outside production.
- Local Firebase fallback behavior outside production.

Incomplete or requiring verification:

- Live SMTP delivery and DNS reputation must be tested with approved recipients.
- Production cron must be configured and observed outside production data first.
- Firebase App Check is documented but not enforced in code.
- Full manual browser QA requires actual staged data and signed-in test users.
- Large-event export strategy is synchronous and should be revisited for very large events.

Removed or corrected in this pass:

- Homepage event empty-state copy no longer implies the event feature itself is not implemented.
- Platform-admin event moderation, reports, categories, and ops visibility were added.
- Event report writes are trusted-server-only in Firestore rules.
- Editing locks are enforced against church representative event mutations.

## Platform Administrator Functionality

Routes:

- `/admin/events`
- `/admin/event-reports`
- `/admin/event-categories`
- `/admin/ops`

Platform administrators can:

- Search and filter events across churches.
- Review event status, owner, church ID, visibility, registration mode, featured state, and editing lock.
- Preview public event pages.
- Publish, unlist, cancel, archive, restore, or move events through validated server transitions.
- Feature or unfeature events.
- Temporarily lock or unlock church representative editing.
- Add moderation notes.
- Review public event reports.
- Mark reports as new, investigating, resolved, or dismissed.
- Add private moderation notes.
- Add, edit, deactivate, restore, and reorder category records.
- View production configuration readiness without printing secrets.

Deferred platform-admin items:

- Bulk actions.
- Direct retry controls for failed transactional emails.
- Direct retry controls for failed scheduled jobs from the admin UI.
- A dedicated audit-history detail page, though event/report/category actions write audit records.

## Category Management

Managed groups:

- Primary event types.
- Audience and ministry tags.
- Languages.
- Accessibility attributes.
- Registration labels.
- Cost-status options.
- Seasonal and holiday categories.

Category rules:

- Internal keys are stable after creation.
- Public labels may change without rewriting historical event records.
- Deactivated categories remain available for historical context.
- Church representatives cannot create global categories.
- The existing `Other` event category behavior remains available through event custom tags.

## Public Event Reporting

Visitors can report an event from the public event detail page for:

- Incorrect information.
- Event cancelled but not marked cancelled.
- Broken registration link.
- Misleading content.
- Spam.
- Duplicate event.
- Inappropriate content.
- Impersonation.
- Other.

Protections:

- Honeypot field.
- Server-side reason validation.
- Message length limits.
- Reporter name/email optional and private.
- IP and user agent hashed when present.
- Firestore direct public writes denied.
- Reports do not automatically remove events.

## Production Configuration Validation

Admin route:

- `/admin/ops`

Validated settings include:

- Firebase client and Admin configuration.
- Firebase Storage bucket.
- Public canonical site URL.
- SMTP provider and credentials.
- Admin notification email.
- Registration token secret.
- Registration scheduler secret.
- Listing verification scheduler secret.
- SMTP reply-to.
- Export signing/revocation planning secret.
- App Check planning key.
- Error monitoring DSN.
- Retention job flag.
- Analytics/Search Console settings.

Secrets are never printed. Missing production-critical settings fail the check only when `NODE_ENV=production`.

## Domain and Canonical Host

Recommended canonical host for the Palacios launch:

- `https://findyourchurchpalacios.org`

Required production behavior:

- `NEXT_PUBLIC_SITE_URL=https://findyourchurchpalacios.org`.
- `www.findyourchurchpalacios.org` redirects to the canonical host if configured.
- HTTP redirects to HTTPS.
- Firebase Hosting/App Hosting preview domains must not be the canonical host.
- `findyourchurch.org` remains a future platform domain unless its hosting, DNS, Firebase Auth domain, sitemap, and canonical configuration are completed.

Sensitive URLs must not appear in canonical tags, analytics, sitemap entries, or public logs:

- Registration management tokens.
- Private export routes.
- Cron secrets.
- Session tokens.

## SEO and Discoverability

Verified expectations:

- Published public events can appear in `/events` and public event detail pages.
- Draft, pending-review, archived, and registration management routes are not public listing paths.
- Cancelled events are `noindex` through page metadata because `generateMetadata` marks non-published events as noindex.
- Public event structured data is generated from sanitized event records.
- Legacy church routes continue to redirect through existing route helpers.

Still requiring manual/live verification:

- Sitemap includes only appropriate published events.
- Open Graph images render correctly for live event flyers.
- Google Calendar URLs use correct live event URLs.
- Search Console sees the intended canonical host.

## Email Readiness

Templates reviewed in code:

- Registration confirmation.
- Waitlist confirmation.
- Waitlist promotion.
- Registration cancellation.
- Event reminders.
- Daily digest.
- Final report.
- Report/export email.

Email requirements:

- `EMAIL_PROVIDER=smtp` or supported production provider.
- `EMAIL_FROM="Find Your Church Palacios <noreply@findyourchurchpalacios.org>"`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD`.
- `SMTP_REPLY_TO=support@findyourchurchpalacios.org` required for the noreply sender.
- `ADMIN_NOTIFICATION_EMAIL` may be comma-separated for launch.
- SPF, DKIM, and DMARC should be configured for the sending domain.

Do not claim production email verified until a real provider test is sent and received by an approved test recipient.

## Scheduler and Cron Readiness

Endpoint:

- `POST /api/jobs/registration`

Required header:

- `x-cron-secret: <REGISTRATION_JOBS_CRON_SECRET>`

Jobs:

- Daily digests.
- Registration-closing reports.
- Pre-event reports.
- Event reminders.
- Event cancellation notices.
- Export cleanup.
- Registration retention cleanup.

Operational requirements:

- Use bounded batches.
- Keep jobs idempotent.
- Record attempts, status, errors, and completion.
- Avoid duplicate sends by using deterministic job IDs.
- Configure scheduler first in staging or production-like environment.

Local preview:

```powershell
npm run process:registration-jobs -- --dry-run
```

## Export and Report Security

Verified design:

- Export records are private Firestore documents.
- Export files are written to private Storage paths.
- Direct Storage reads are denied.
- Download route requires authenticated representative access.
- Export links expire by record metadata.
- Sensitive fields are excluded unless explicitly selected and confirmed.
- Spreadsheet formula injection is neutralized.
- Export creation and download are audited without storing registration answer values.

Remaining production check:

- Confirm expired export cleanup deletes files in the real bucket.
- Confirm revoked users cannot use old sessions after revocation.

## Data Retention and Privacy

Defaults:

- Registration retention is configured per event registration setup: 180 days by default, with validated range 30–730 days after the event ends.
- Export retention is 24 hours.
- Registration-management tokens expire after 180 days; rotating the token secret revokes all existing links.
- Access/export token and temporary export cleanup is authenticated, idempotent, bounded, audited, church/event scoped, and certified in hosted staging.
- Audit records should keep minimal metadata and avoid answer values.

Retention decisions still required before production:

| Record | Current application behavior | Production decision |
| --- | --- | --- |
| Registrations and related answers | Per-event cleanup after 30–730 days, default 180; deletes registrations, token/confirmation/idempotency/rate-limit records and counter in batches of 400 | Privacy owner approves default/allowed overrides and minor-data handling |
| Temporary exports and export tokens | Private download expires after 24 hours; cleanup selects at most 100 exports and 400 tokens per pass | Operations verifies schedule, alert, and bucket deletion |
| Management tokens | Hash stored; normal expiry 180 days; expired-token cleanup bounded to 400 | Ministry operations approves duration and communication on secret rotation |
| Scheduler jobs | Lease/retry/idempotency state retained; no approved record-retention cleanup | Operations/privacy set and enforce a duration |
| Audit, email, and operational logs | Minimal metadata retained; no answer payload; no approved automated retention | Operations/privacy set and enforce durations before launch |
| Event-level cleanup | Registration personal data is deleted while event/form definitions and minimal audit history remain | Privacy/legal approve deletion/anonymization policy |

One failed scheduler record is isolated and retried without stopping the batch; leases allow safe resume. Hosted certification proved authenticated cleanup, cross-church isolation, duplicate suppression, retry, and operational logging.

Operational process:

1. Locate a registration by confirmation number or authorized event search.
2. Verify the requester and event/church relationship.
3. Cancel the registration if needed.
4. Delete or anonymize eligible personal data.
5. Record that deletion occurred without retaining deleted sensitive content.
6. Preserve minimal audit/security records when legally or operationally necessary.

Special handling:

- Child, health, emergency, allergy, and accessibility information should be collected only when necessary and excluded from general email/report output by default.
- Policy language requires legal review before production launch.

## Accessibility Review

Automated accessibility tooling is not configured in this repo. Manual review is required for:

- Keyboard navigation.
- Focus order and visible focus.
- Form labels and required-field notices.
- Error summaries.
- Screen-reader status messages.
- Conditional fields.
- Tables and mobile table alternatives.
- Touch target size.
- 200 percent zoom.
- Color contrast.
- Reduced-motion behavior.
- Meaningful flyer alt text.

Current status:

- Not fully manually verified in this phase.
- Recommendation cannot be full GO until manual accessibility QA is complete.

## Manual QA Matrix

Record results as `Pass`, `Fail`, `Not tested`, or `Environment limitation`.

Viewports:

- Small mobile phone.
- Standard mobile phone.
- Large mobile phone.
- Tablet portrait.
- Tablet landscape.
- Laptop.
- Desktop.

Public workflows:

- Browse events.
- Filter events.
- Open event.
- Share event.
- Add to calendar.
- Report event information.
- Register.
- Join waitlist.
- Receive confirmation.
- Open management link.
- Edit or cancel registration if enabled.

Church administrator workflows:

- Create event.
- Upload flyer.
- Save draft.
- Publish.
- Edit.
- Duplicate.
- Cancel.
- Archive.
- Build registration form.
- View registrations.
- Add manual registration.
- Check in attendee.
- Export PDF.
- Export XLSX.
- Email report.

Platform administrator workflows:

- Find event.
- Moderate event.
- Feature event.
- Lock editing.
- Review public report.
- Update report status.
- Manage categories.
- Review configuration checks.

Current matrix result:

- Automated coverage: pass for tested scripts.
- Manual browser QA: not completed in this phase.

## Performance Review

Current safeguards:

- Public event lists are limited.
- Registration dashboard uses pagination.
- Capacity checks are transactional.
- Search prefixes are indexed.
- Large private answer values are not loaded publicly.

Risks:

- PDF/XLSX exports are generated in memory.
- Very large events may need async export chunking.
- Admin event filters currently limit result counts and then apply some filters in memory.
- Manual load testing with hundreds of registrations is still needed.

Recommended practical limits before national expansion:

- Document maximum public registration payload size.
- Add async export jobs for events above a registration threshold.
- Add monitoring for slow export generation.

## Dependency Security Results

Previous safe remediation:

- `nodemailer` upgraded to `9.0.3`, clearing the high advisory.
- Next upgraded within the 15.5 patch line during safe audit fix.
- Firebase Admin upgraded from `13.10.0` to `14.1.0` after confirming Node 22 deployment, modular imports, TypeScript, all deterministic suites, Firestore/Storage/Auth emulator security, lint, and the 40-page production build. This removed the Firestore and `google-gax` advisory nodes.

Remaining advisories after `npm audit --omit=dev`:

- 9 moderate advisories, 0 high, and 0 critical.
- Next/PostCSS advisory remains reported by npm audit, with `npm audit fix --force` suggesting an unsafe downgrade path.
- Firebase Admin now inherits the remaining UUID/request advisory only through its latest compatible Cloud Storage dependency; the Firestore transport path is clear.
- `npm audit fix --omit=dev --dry-run` did not produce a safe production remediation path for the remaining 9 nodes and pointed to unsupported parent-package downgrades or major changes.

Accepted residual risk for this phase:

- Do not run `npm audit fix --force`.
- Do not downgrade Next or ExcelJS.
- Track upstream Firebase Admin/Google Cloud and Next patch releases.
- Re-run audit before production launch.

## Monitoring and Alerts

Operational visibility added:

- `/admin/ops` configuration checks.
- `/admin/events` event status/moderation visibility.
- `/admin/event-reports` public report queue.
- Audit logs for platform event actions, report actions, and category changes.

Recommended alerts:

- Any failed scheduled registration job.
- More than 3 failed email sends in 15 minutes.
- Export generation failures.
- Registration counter mismatch.
- Repeated authorization denials from the same account/IP.
- Storage cleanup failures.
- Cron endpoint unauthorized attempts.

Response process:

1. Check `/admin/ops`.
2. Review email logs and audit logs.
3. Disable registration for the affected event if needed.
4. Disable scheduler if duplicate sends are suspected.
5. Preserve logs before cleanup.

## Backup, Recovery, and Rollback

Before launch:

- Enable Firestore backups or scheduled exports.
- Confirm Storage bucket retention/backup expectations.
- Deploy indexes before code that requires them.
- Deploy Firestore and Storage rules before enabling public registration.
- Configure env vars before traffic reaches new routes.

Rollback steps:

1. Disable scheduler calls to `/api/jobs/registration`.
2. Set events to external registration or `none` if internal registration must pause.
3. Redeploy previous application release.
4. Keep Firestore data intact unless a tested migration rollback exists.
5. Preserve `eventRegistrations`, counters, tokens, exports, and audit logs.
6. If token secret is compromised, rotate `REGISTRATION_TOKEN_SECRET` and treat existing management links as revoked.
7. If export secret/access is compromised, delete unexpired export files and records.
8. Rebuild registration counters from registrations if counts drift.

Do not test destructive recovery steps against production.

## Deployment Order

1. Review and approve code.
2. Configure production env vars.
3. Deploy Firestore indexes.
4. Deploy Firestore rules.
5. Deploy Storage rules.
6. Deploy application.
7. Verify `/admin/ops`.
8. Create test event in staging or approved production test window.
9. Test registration and emails.
10. Configure scheduler.
11. Verify scheduled job logs.
12. Run manual browser QA.
13. Decide go/no-go.

## Automated Verification Results

Executed in this phase:

- `npx tsc --noEmit`: passed.
- `npm run test:event-validation`: passed.
- `npm run test:directory-routing`: passed.
- `npm run test:registration-validation`: passed.
- `npm run test:registration-reports`: passed.
- `npm run test:registration-scheduler`: passed.
- `npm run test:registration-scheduler-security`: passed authentication, method/body, retry, and lease policy checks.
- `npm run test:staging-email`: passed 15 template/render checks, opened generated PDF/XLSX files, enforced the single-recipient guard, and redacted a controlled non-delivering SMTP failure; live delivery was not attempted.
- `npm run test:platform-launch-readiness`: passed.
- `npm run test:staging-validation`: passed.
- `npm run test:event-security`: passed through Firebase emulators for Firestore, Storage, and Auth.
- `npm run test:registration-emulator`: passed through the Firestore emulator.
- `npm run lint`: passed with no ESLint warnings or errors.
- `npm run build`: passed.
- Focused App Hosting local-source rollout to `community-hub-staging`: passed.
- `npm run test:staging-scheduler-hosted`: passed hosted authentication, environment, body/method, correlation-ID, and client-bundle secret checks.
- `npm run certify:staging-scheduler`: passed real hosted digest, reminder, closing-report, export/token cleanup, retention cleanup, overlap, retry, duplicate, cross-church, and operational-log checks.
- `npm run test:staging-admin-ops`: passed authenticated platform-admin staging banner, SMTP-blocked state, template catalog, disabled-send, and scheduler-event checks.
- Manual run of Cloud Scheduler job `community-hub-registration-jobs-staging`: passed; job state remained `ENABLED` with clear last-attempt status.
- `npm audit --omit=dev`: completed with 9 moderate advisories after the Firebase Admin 14 compatibility update.
- `npm audit fix --omit=dev --dry-run`: reviewed only; no changes kept.
- `npm run seed:community-hub-staging -- --dry-run`: passed.
- `npm run seed:community-hub-staging -- --dry-run --large`: passed.
- Emulator seed/reset round trip: passed without touching live Firebase.

Manual/staging verification still required:

- Live SMTP delivery and bounce behavior.
- Live SMTP delivery, mailbox receipt, bounce behavior, and emailed attachment inspection.
- Browser/device QA matrix.
- Accessibility review with signed-in representative/admin flows.
- Sitemap/Open Graph verification on the final canonical host.

## Traceability Matrix

| Requirement | Implemented | Automatically tested | Manually tested | Staging verified | Production verification required | Evidence | Remaining risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Platform administration | Yes | Partial | No | No | Yes | `/admin/events`, server actions, `test:platform-launch-readiness` | Needs browser/auth staging verification |
| Event moderation | Yes | Partial | No | No | Yes | Public report form, `/admin/event-reports`, Firestore rules | Needs report workflow tested in staging |
| Category management | Yes | Partial | No | No | Yes | `/admin/event-categories`, category repository/actions | Needs admin browser verification |
| Configuration validation | Yes | Yes | No | No | Yes | `/admin/ops`, `production-config-service`, `test:platform-launch-readiness`, `test:staging-validation` | Needs real staging/prod env review |
| Domain behavior | Documented | Partial | No | No | Yes | `NEXT_PUBLIC_SITE_URL`, sitemap/build checks | Requires preview/canonical URL inspection |
| SEO | Implemented for public events | Partial | No | No | Yes | Metadata and public event tests/build | Requires Search Console/canonical host review |
| SMTP | Templates and admin-only staging tool implemented | Yes for 15 templates and PDF/XLSX rendering | No live send | Blocked | Yes | `test:staging-email`, `/admin/ops` | Approved SMTP account and test mailbox are missing |
| Scheduler | Implemented and configured | Yes local and hosted | Yes, Cloud Scheduler job run | Yes | Yes | `test:registration-scheduler-security`, `certify:staging-scheduler`, Cloud Scheduler logs | Production remains unconfigured by design |
| Exports | Implemented | Yes for PDF/XLSX generation and opening | Hosted closing-report generation | Yes | Yes | `test:staging-email`, hosted scheduled closing report | Email attachment receipt remains blocked with SMTP |
| Data retention | Implemented/documented | Yes | Hosted fictitious-data cleanup | Yes | Yes | Registration emulator and `certify:staging-scheduler` | Production schedule/retention approval remains required |
| Accessibility | Critical/high resolved | 66 axe scans plus keyboard/semantic review | Hosted | Yes for available engines | Yes | `docs/community-ministry-hub-accessibility.md` | Native screen reader and WebKit/Safari remain unavailable |
| Responsive browser QA | Verified in available engines | Chromium, Edge, Firefox | Hosted | Yes | Yes | Hosted Playwright matrix | Standalone Chrome and WebKit/Safari unavailable |
| Performance | Bounded and load-verified | 131 events / 1,125 registrations / 500-record export fixture | Hosted | Yes | Yes | `test:staging-performance-seo` | Supported limits documented; no performance blocker found |
| Dependency advisories | Documented | Yes audit | N/A | N/A | Yes | `npm audit --omit=dev --json`, security acceptance doc | 9 moderate advisories need owner acceptance |
| Monitoring | Ops visibility and correlation logs | Partial | Yes for scheduler success/failure | Yes | Yes | `/admin/ops`, Cloud Scheduler/Application logs | Recommended failure alerts remain unconfigured |
| Backup | Documented | No | No | No | Yes | Rollback/deployment docs | Needs managed backup confirmation |
| Rollback | Documented | No | No exercise | No | Yes | `docs/community-ministry-hub-rollback.md` | Needs nonproduction exercise |
| Existing church workflows | Existing tests pass | Partial | No staging browser | No | Yes | directory routing/build/regression tests | Needs staging regression pass |

This was the pre-certification checkpoint and supported `CONDITIONAL GO` only. The final July 14 certification below supersedes it. Scheduler, hosted cleanup, browser/accessibility, performance, SEO, and report-generation staging evidence are complete.

## Final Recommendation

Historical pre-certification recommendation: `CONDITIONAL GO`.

Reasons:

- Automated tests and rules checks can validate the core architecture.
- Platform admin moderation/category/config surfaces now exist.
- Live staging SMTP, production scheduler/App Check, accessibility, and manual browser QA still need environment-backed verification.
- Remaining dependency advisories require explicit acceptance or future upstream-safe updates.

Focused SMTP/scheduler recommendation on July 13, 2026: **Still blocked**. The blocker is limited to the absent approved staging SMTP provider credentials, sender/reply-to configuration, administrator recipient, and QA-owned `TEST_EMAIL_TO`. Cloud Scheduler is enabled and certified in staging; no production scheduler or deployment was created.
## Performance And SEO Validation Addendum — July 14, 2026

- Hosted large-data validation passed with 131 events, 1,125 registrations, and 500 registrations on one event.
- Warm public response start was 97–246 ms and public DOM-ready was 159–460 ms in Chromium. A zero-instance cold homepage request was 3.623 s response start / 4.068 s DOM-ready; staging intentionally retains `minInstances: 0`. The disabled donation integration no longer loads its third-party modal script. The 500-registration dashboard was DOM-ready in 968 ms and rendered 25 rows; platform event administration was DOM-ready in 519 ms and rendered 50 rows.
- All 25 staging composite indexes remain ready. No index change is required for current application query shapes.
- Public event queries remain published/public/previously-published and bounded. Registration queries are event/church scoped; admin events and reports now cursor-page at 50. Directory filter values reuse the already loaded bounded church result.
- Six 500-registration PDFs completed in 2.122–3.545 seconds and 175–203 kB; XLSX completed in 2.027 seconds and 62 kB with correct rows, totals, participant/answer-summary sheets, long text, and formula protection.
- The operating limits and detailed measurements are recorded in `docs/community-ministry-hub-staging-qa.md`.
- Staging uses its own canonical origin and global `noindex`. The production decision remains the non-`www` HTTPS host `https://findyourchurchpalacios.org`; alternate/default domains must redirect after configuration is confirmed.
- Sitemap, structured Event data, Open Graph metadata, unlisted privacy, token non-disclosure, Google Calendar, and ICS tests passed.

At this checkpoint, full staging certification remained blocked by provider-backed SMTP delivery and assistive-technology/browser evidence. The later final matrix passed Playwright WebKit; native screen-reader evidence remains unavailable. This addendum is not production approval.

## Final Monitoring And Alert Plan — July 14, 2026

This plan defines the production alerts and ownership that must be configured after launch approval and before registrations open. No production alert, sink, recipient, or on-call integration was configured during staging certification.

### Verified Log Coverage

| Operational area | Current evidence source | Coverage | Sensitive-data posture |
| --- | --- | --- | --- |
| Event creation/publication/flyer changes | `auditLogs` actions for create, publish, update, upload, replace, and delete | Implemented and exercised in hosted staging | Event/church IDs, status, and Storage metadata only; no registration answers |
| Registration submissions/capacity/waitlist | Transactional registration/audit records and counters | Implemented; success/waitlist/idempotency/capacity behavior tested | Registration records are private; audit notes omit answer values |
| Email success/failure | `emailLogs`; `transactional_email_failed` operational event | Template/render and failure redaction verified; provider success not certified | Console body omitted; credential redaction; recipient domain only in operational failure metadata |
| Export success/failure/expiry | `eventExports`, audit actions, private Storage, scheduler cleanup outcome | Generation, download, expiry, and cleanup tested | Private path; authorized church/event scope; no raw signing token in logs |
| Scheduler and cleanup | `operationalEvents` start/job/completion/failure records with correlation IDs | Hosted auth, overlap, retry, duplicate, cleanup, retention, and pause/resume verified | Counts, job IDs/types, attempts, safe errors; no registration payload |
| Event reports | Private report record, audit action, `event_report_created` operational event | Implemented and hosted admin moderation tested | Operational record includes report/event ID and reason only; reporter details stay private |
| Authorization denial | Framework/infrastructure logs and failed access result | Enforcement verified, dedicated operational event incomplete | Do not log tokens, answers, child/medical data, addresses, or full identity payloads |
| Rate limiting | Transactional rate-limit record and rejected request | Enforcement tested, dedicated operational event incomplete | Request identity is hashed for the Firestore key; raw IP must not enter operational logs |

Successful event/registration/export operations are distributed across audit, email, export, and operational collections rather than one external monitoring provider. Authorization-denial and rate-limit operational event types are incomplete. These are monitoring gaps, not permission bypasses, and require launch-owner acceptance plus infrastructure-log alerts until application telemetry is expanded.

### Alert Conditions And Response Ownership

Recipient roles must be mapped to named people and private contact channels in the launch record. `Platform technical owner`, `Ministry operations owner`, and `Incident commander` are placeholders until that mapping is approved.

| Condition | Initial threshold | Alert recipient | Manual fallback | Escalation | Response owner |
| --- | --- | --- | --- | --- | --- |
| Repeated SMTP failure | 2 consecutive required sends or 3 failures in 15 minutes | Ministry operations owner + platform technical owner | Pause outbound jobs, use approved manual contact, keep registrations closed if confirmation is required | Incident commander after 15 minutes or any broad recipient impact | Ministry operations owner |
| Repeated scheduler failure | 2 consecutive invocations, any terminal job failure, or no successful run for 45 minutes | Platform technical owner | Pause job, invoke a dry run/manual controlled run, process urgent reminder/report manually | Incident commander after one missed business-critical window | Platform technical owner |
| Export cleanup failure | Any terminal cleanup failure or expired private export older than 30 hours | Platform technical owner | Pause export generation, delete identified expired files/records through reviewed script | Security/incident commander if a stale link remains usable | Platform technical owner |
| Retention cleanup failure | Any terminal retention job or data past approved retention by more than 24 hours | Privacy owner + platform technical owner | Close affected event registration, run bounded dry run, then reviewed cleanup | Incident commander/privacy owner for minor-related or sensitive data | Privacy owner |
| Storage failure | 3 trusted upload/download failures in 15 minutes or any private-export exposure | Platform technical owner | Disable flyer upload/export generation; retain existing safe flyers | Immediate security escalation for cross-church/private exposure | Platform technical owner |
| Registration-count inconsistency | Any counter/record reconciliation mismatch | Ministry operations + platform technical owner | Close affected registration, pause scheduler/email, rebuild counts with reviewed script | Incident commander if capacity or waitlist decisions were wrong | Platform technical owner |
| Configuration validation failure | Any production required check fails at startup or `/admin/ops` | Platform technical owner | Keep prior revision serving; do not open registrations/email/jobs | Incident commander before any launch continuation | Deployment operator |
| High authorization-denial rate | 50 denials in 5 minutes or 5x the established 7-day baseline | Security/technical owner | Inspect infrastructure logs, rate-limit abusive source, verify no valid-user lockout | Incident commander for cross-church attempts or sustained abuse | Security/technical owner |
| High registration-submission failure rate | More than 10% over 15 minutes with at least 20 attempts | Ministry operations + platform technical owner | Close affected registration, post approved status message, accept controlled manual fallback only if privacy-approved | Incident commander after 15 minutes or capacity inconsistency | Ministry operations owner |

### Escalation Procedure

1. Acknowledge the alert and record environment, project, database, bucket, revision, event/church scope, and correlation IDs without copying sensitive payloads.
2. Classify public exposure/isolation, data integrity, delivery, availability, or configuration failure.
3. Apply the smallest containment action: close affected registration, pause Scheduler, disable email/export, or return traffic to the previous release.
4. Preserve audit/email/operational/infrastructure logs and the backup reference.
5. Follow `docs/community-ministry-hub-rollback.md` when a rollback trigger is met.
6. Require incident-commander and ministry-operations approval before resuming registrations, email, or Scheduler.

### Monitoring Launch Gate

Before production registrations open:

- Configure an external log/alert destination and verify one controlled alert reaches the named recipients.
- Confirm access controls and approved retention for `auditLogs`, `emailLogs`, `eventScheduledJobs`, and `operationalEvents`.
- Confirm alert queries exclude answers, passwords, secrets, access/export tokens, child information, allergy/medical data, complete addresses, and emergency contacts.
- Record the manual email, reminder/report, export cleanup, retention cleanup, registration closure, and count-rebuild fallbacks.
- Assign the observation-window incident commander and response owners.

## Final Requirement Traceability — July 14, 2026

Documentation is not counted as functional evidence. `Automated` names an executed test surface; `Hosted/manual` distinguishes real hosted execution from operator inspection. Production-only checks remain open by design.

| Requirement | Implemented | Automated evidence | Hosted staging evidence | Manual evidence | Production-only verification remaining | Risk | Launch blocking |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public events | Yes | Event validation, security rules, hosted workflows | Listing/filter/status/visibility passed in all engines | Hosted output inspected during rollback | Canonical production content | Low | No |
| Event detail | Yes | Metadata, calendar, accessibility, workflow tests | Published/cancelled/unlisted/direct-link states passed | Public smoke during rollback | Controlled production event | Low | No |
| Church events | Yes | Directory routing and hosted workflow tests | Church upcoming-event projection passed | Existing church record counts reconciled | Production church content | Low | No |
| Representative event management | Yes | Validation, security, hosted workflows | Create/edit/draft/publish/cancel/archive controls passed | Staging records observed before/after rollback | Controlled production representative | Low | No |
| Flyer upload | Yes | Storage emulator/live Storage tests | Trusted server upload and public display passed | Bucket/path metadata inspected | Production bucket/CORS/runtime identity | Medium | Yes if failed in deployment window |
| Registration modes | Yes | 25 validation cases and browser workflows | None/simple/external/custom paths exercised | None separate | Controlled production mode sample | Low | No |
| Custom form builder | Yes | Validation, accessibility, workflow tests | Build/reorder/conditional/repeating controls passed | None separate | Controlled production form | Low | No |
| Capacity | Yes | Atomic emulator concurrency/counter tests | 500-record dashboard/export fixture passed | Counter counts reconciled | One controlled production registration | Medium | Yes on inconsistency |
| Waitlists | Yes | Atomic capacity, cancellation, promotion tests | Hosted registration states and scheduler fixture passed | Scheduler outcomes inspected | Controlled production capacity edge | Medium | Yes on oversubscription |
| Confirmation | Yes | Render/template and browser tests | Confirmation page/number/management handoff passed | None separate | Provider-backed received email | High | Yes: SMTP delivery blocked |
| Registration management | Yes | Token, expiry, isolation, cancellation tests | Tokenized management/cancellation passed | Token values never recorded | Production secret/expiry check | Medium | Yes on token exposure |
| Check-in | Yes | Hosted workflow/accessibility tests | Search/action/toggle/restore passed in all engines | None separate | Controlled production record | Low | No |
| PDF exports | Yes | Six report variants plus 500-record load | Portrait/landscape roster/sign-in/check-in passed | Generated files opened during SMTP tests | Production timeout/private download | Medium | Yes on privacy failure |
| XLSX exports | Yes | Workbook/sheet/formula-injection tests | 500-row workbook, 833 participant rows passed | Generated workbook opened | Production timeout/private download | Medium | Yes on privacy failure |
| Report emails | Application yes; delivery no | Templates, attachments, recipient guard, failure redaction | Admin send stayed disabled with console provider | `/admin/ops` SMTP-blocked state inspected | Real provider receipt/sender/links/bounce | High | **Yes** |
| Scheduled jobs | Yes | Auth, lease, retry, idempotency, cleanup/retention tests | Authorized/unauthorized endpoint and real Scheduler passed | Job pause/resume and status inspected | Production job/secret/alerts | Medium | Yes until configured |
| Platform administration | Yes | Launch-readiness and hosted workflows | Events/locks/ops passed in all engines | Admin records inspected | Controlled production admin | Low | No |
| Event moderation | Yes | Platform and hosted workflow tests | Report queue/action passed | None separate | Controlled production report | Low | No |
| Category management | Yes | Platform and hosted workflow tests | Category surface/actions passed | None separate | Controlled production category | Low | No |
| Security isolation | Yes | Firestore/Auth emulator and hosted role tests | Public registration denial, cross-church event/registration denial passed | Rules/project identifiers reviewed | Production rules probes after deploy | High impact | Yes on any failure |
| Storage security | Yes | 8 emulator and live staging controls | Public flyer/private export/cross-church/write/delete policy passed | Bucket name and rules inspected | Production rules/bucket probes | High impact | Yes on any failure |
| Accessibility | Yes for tested scope | 63 final axe scans; keyboard/reflow suite | 209/210 matrix tests passed; no critical/high open | DOM/accessibility semantics reviewed; native reader unavailable | Native screen-reader test or acceptance | Medium | **Yes pending owner decision** |
| Browser support | Yes for available engines | Chromium/Firefox/WebKit final; prior Edge pass | Public/rep/admin workflows passed | Native Safari/standalone Chrome unavailable | Owner-defined device matrix | Low | No by default |
| Performance | Yes within limits | Static and hosted performance/load tests | 137 events, 1,131 registrations, 500-record fixture; bounded pages | Metrics and index readiness inspected | Production cold/warm baseline/alerts | Medium | No if limits accepted |
| SEO | Yes | Metadata, robots, sitemap, schema, OG, calendar tests | Staging canonical/noindex and exclusions passed | Hosted documents inspected | Production domain, Search Console, sitemap submit | Medium | Yes before indexing |
| Monitoring | Application logging yes; external alerts no | Scheduler/email failure and redaction tests | `/admin/ops`, audit/email/operational events passed | Logs/correlation/status inspected | Configure/verify alert destinations and retention | High | **Yes** |
| Retention | Registration/export/token cleanup yes; log policy open | Authenticated bounded idempotent cleanup tests | Retention/export/token cleanup passed | Cleanup outcomes inspected | Approve audit/email/job/log periods and production schedule | High | **Yes** |
| Backup | Plan/inventory only | No restore automation claimed | Staging reported no managed backup schedule | Project/bucket/rules/index/secret-name inventory inspected | Enable and verify production Firestore/Storage recovery | High | **Yes** |
| Rollback | Yes for compatible application release | Hosted smoke/dataset checks around exercise | Prior release and latest release both passed; data preserved | Scheduler pause/resume and counts observed | Production backup reference/previous revision/operator | Medium | Yes until preflight complete |
| Existing church workflows | Yes | Directory routing plus final regression spec | Homepage, directory/count/filter, church/legacy/claim, submit/contact/policies, portal/account/edit, admin, mobile nav passed | Donation disabled-state inspected | Production donation, contact delivery, real content | Medium | Yes for production-only integrations |

Traceability result: core Community Ministry Hub functionality, isolation, hosted workflows, accessibility automation, performance, SEO, Scheduler, exports, rollback compatibility, and existing-site regressions are evidenced. The unresolved launch gates are operational rather than undocumented: provider-backed SMTP, explicit advisory/App Check/native-reader risk decisions, external alerting/log retention, production backup/Storage recovery, and deployment-window production checks.

## Final Automated And Hosted Evidence

| Test surface | Final result |
| --- | --- |
| TypeScript | Passed: `npx tsc --noEmit` |
| Event/directory/registration validation | Passed: 9 event checks, directory routing, 25 field types/6 presets |
| Reports | Passed: 6 PDF variants, workbook sheets, 8 templates; hosted 500-record exports passed |
| Scheduler unit/security | Passed: auth, request/method/body, retry, lease, policy, idempotency |
| Platform/staging/performance-SEO static | Passed: 7 launch checks, 6 staging guards, 8 SEO/calendar/limit checks |
| Firestore and Storage emulator rules | Passed: 8 Firestore and 8 Storage controls |
| Registration emulator | Passed: authorization, capacity, idempotency, waitlist, versioning, pagination/search, audit/deletion/token/scheduler paths |
| Live staging Storage | Passed after loading an ephemeral OAuth token into process memory; no credential persisted |
| Hosted public smoke | Passed: 8 public visibility/canonical/flyer/token checks |
| SMTP application tests | Passed: 15 templates/rendering, PDF/XLSX, recipient guard, redacted controlled failure; real delivery not attempted |
| Hosted Scheduler | Passed: unauthorized/authenticated requests, environment/body/method guards, correlation, retry/overlap/deduplication/digest/reminder/report/cleanup/retention |
| Admin operations | Passed: staging banner, SMTP-blocked state, template catalog, scheduler logs |
| Hosted final browser matrix | Passed 209, skipped 1 intentional evidence-capture case, failed 0 in 14.1 minutes across Chromium/Firefox/WebKit; prior Edge evidence also passed |
| Existing-site final regression | Passed in all three final engines: public/legacy/forms/policies/mobile/representative/admin |
| Accessibility | 63 final axe scans passed with no critical/serious findings; keyboard, 7 viewports, 200% reflow passed |
| Performance/SEO/export | Passed in final hosted matrix; public and authenticated metrics, 500-record PDF/XLSX, sitemap/schema/OG/calendar/privacy passed |
| Staging production build | Passed: Next.js 15.5.20, 40 static pages; ignored local production service-account path emitted a non-blocking missing-file warning and was not used |
| Lint and whitespace | Lint passed with no warnings/errors; final `git diff --check` is required after documentation edits |
| Dependency audit | Completed after Firebase Admin 14 compatibility update: 346 production dependencies, 9 moderate advisory nodes, 0 high, 0 critical; npm exits 1 because advisories remain |
| Environment-blocked evidence | Provider SMTP delivery, native screen-reader, native Safari/standalone Chrome; legacy phase-3/phase-4 integration scripts referenced a missing local production service-account file and were not repointed |

## Final Certification Decision

### NO-GO

The code and hosted staging application are suitable for merge review, but production deployment is not approved. The blocking reasons are:

- no provider-backed SMTP delivery, sender/link/mailbox/attachment/bounce evidence;
- no explicit launch-owner acceptance or remediation of the 9 remaining moderate advisory nodes;
- no recorded production App Check enforcement-or-monitor decision;
- no configured and tested external alert destinations;
- no approved retention periods for audit/email/job/operational logs;
- no verified production Firestore backup and Storage recovery settings;
- no native screen-reader evidence or signed residual-risk acceptance;
- production secrets, DNS/canonical host, SMTP/DNS, Scheduler, App Check, indexes/rules, and controlled smoke tests necessarily remain deployment-window work.

`GO` requires every blocking acceptance item in `community-ministry-hub-security-acceptance.md` plus the release gate in `community-ministry-hub-production-deployment.md`. No production deployment, merge, or push is authorized by this certification.

## Production Blocker Closure Update — July 14, 2026

This section supersedes earlier statements that staging SMTP used `console`, App Check lacked a decision, alerts were unconfigured, retention periods were absent, or staging lacked recovery protection.

| Blocker | Current evidence | State |
| --- | --- | --- |
| SMTP provider delivery | Namecheap Shared Hosting Mail delivered seven controlled staging messages. The approved production credential was later bound through Secret Manager and a controlled production message was accepted with SMTP 250 and received. SPF, DKIM, and DMARC passed; DMARC is `p=none`. Support Reply-To, universal unmonitored-mailbox notice, Return-Path, no sensitive answers, and staging PDF/XLSX attachments were verified. | Production delivery certified; authorized live bounce or explicit owner acceptance remains |
| App Check | Production reCAPTCHA Enterprise token exchange returned HTTP 200. Firestore, Storage, and Authentication are `ENFORCED`; unattested Authentication is rejected and attested traffic passes. | Production enforcement certified |
| External monitoring | Production has three enabled email channels, 12 safe log metrics, one HTTPS uptime check, and 13 enabled policies matching the approved thresholds. Controlled configuration and real five-minute outage alerts were received. | Production monitoring certified for the verified launch-owner channel |
| Firestore backup | Production has PITR, delete protection, daily/14-day and Sunday-weekly/12-week managed schedules. A PITR clone passed, but no scheduled backup artifact exists yet. | First managed-backup restore remains blocking |
| Storage recovery | Production seven-day soft delete is active; versioning is intentionally disabled. A fictitious deleted object was restored and matched by hash/size. | Production recovery certified |
| Operational retention | Production TTL is active: audit 400 days, email 180 days, terminal Scheduler jobs 90 days, operational events 180 days. `/admin/ops` exposes safe superadmin summaries without bodies/recipients. | Production retention certified |
| Dependency audit | Firebase Admin 14 passed the complete compatibility suite and removed two nodes. The remaining audit is 9 moderate nodes, 0 high, 0 critical across Next/PostCSS/Firebase Admin/Cloud Storage transports/UUID/ExcelJS paths. Available npm suggestions are incompatible downgrades, parent-package major changes, or unsupported overrides. | Awaiting explicit owner acceptance/remediation; blocking |
| Native screen reader | Narrator started against hosted staging in Chrome and the expected page semantics were exposed. Its speech-recap surface runs at higher Windows integrity than the automation helper, so spoken output could not be inspected. The human listening matrix in `community-ministry-hub-accessibility.md` remains unexecuted. | Blocking |

Current recommendation remains **NO-GO**. Once the native screen-reader run passes, dependency risk is explicitly accepted or remediated, the first managed backup/restore evidence is recorded, and bounce handling is tested or explicitly accepted, the project can move to a controlled GO decision. SMTP binding/delivery, App Check enforcement, production indexes, canonical redirects, and controlled public/role smoke now pass. The owner explicitly waived SMTP credential rotation.

### Production preflight update — July 14, 2026

- Verified identifiers: project `findyourchurch-24562`, database `findyourchurchpal` (`nam5`), bucket `findyourchurch-24562.firebasestorage.app`, backend `findyourchurch-palacios`.
- Firestore PITR/delete protection and daily/weekly schedules are active. An isolated PITR clone matched representative church/location document identities and field counts and was removed; Storage soft-delete recovery passed. The first managed backup has not appeared.
- Production App Check token exchange returned HTTP 200; Firestore, Storage, and Authentication are `ENFORCED`. Unattested Authentication is rejected and attested browser traffic passes.
- Production monitoring now has 3 email channels, 1 content uptime check, 12 log metrics, and 13 policies. A controlled incident was actually received and resolved at the launch-owner Gmail mailbox. The website-unavailable policy was corrected from a stale check ID to the verified production check; the current homepage failure then opened a real critical incident after five minutes and delivered the critical outage email.
- Production Cloud Logging retention is 30 days for `_Default` and 400 days for locked `_Required`. TTL policies for audit, email, terminal-job, and operational-event collections are `ACTIVE`; those production collections were empty, so no historical backfill was needed.
- Apex DNS/TLS passed. The required `www` A/TXT records are published; App Hosting reports active host/ownership/certificate state and path-preserving HTTPS 308 redirects pass.
- Namecheap plan is Stellar Plus: 200 messages/hour/domain and 100 recipients/message. Production SMTP delivery, SPF, DKIM, DMARC, TLS, Return-Path, support Reply-To, and the universal notice pass. Live bounce handling remains untested because no invalid recipient was authorized.
- All 27 production composite indexes are `READY`. The two production-only gaps discovered by live probes were `events(status, startsAt ASC)` and `events(churchId, status, startsAt ASC)`; both are now checked in and ready. Homepage, events, directory, and a real church profile return meaningful content without the prior Server Components error, and the post-fix Cloud Run stderr query returned no new index failure.
- Six production Secret Manager resources hold all sensitive App Hosting values, including SMTP; App Hosting access is granted and plaintext backend overrides are removed.

These results close production monitoring and Storage-recovery configuration, but they do not change the **NO-GO** recommendation.

### Recertification accounting

The current code passed TypeScript; event, directory, registration, report, Scheduler, platform, staging, Firestore/Storage security, and registration-emulator suites; live staging Storage and Scheduler certification; hosted smoke; App Check; performance/SEO; lint; and a staging-configured production build. The complete hosted browser command produced 207 pass, 4 skip, and 5 initial failures. Every failed case passed on targeted rerun after the QA harness used the approved SMTP recipient and added a one-time retry for Edge/Firefox `NS_BINDING_ABORTED`; a transient Chromium form-state case passed on a clean rerun. All axe accessibility scans in the complete command passed. Native screen-reader testing remains unexecuted and is not inferred from automation.

## Production Launch Remediation Evidence — July 14, 2026

This section supersedes earlier production-preflight statements that App Check was unenforced, SMTP was unbound, required indexes were missing, or authenticated smoke had not run.

- Branch `feature/community-hub-production-launch-remediation` was pushed only after explicit owner authorization. It was not merged to `main`.
- App Hosting rollout `build-2026-07-14-001` succeeded from commit `e015e26116897b9db75498f6f76046ef1b51b52f`; the matching Cloud Run revision serves 100% of traffic with no new stderr errors in the verification window.
- All 27 required composite indexes are `READY`. Homepage, events, directory, and a real church profile render without the previous index failure.
- The production reCAPTCHA Enterprise exchange returned HTTP 200. Firestore, Storage, and Authentication are `ENFORCED`; an unattested Authentication request receives HTTP 401 while an attested browser request reaches normal credential validation.
- Six production Secret Manager resources cover every sensitive App Hosting value. `/admin/ops` reports 26 passes, 2 warnings, and 0 configuration failures without revealing values.
- The Namecheap SMTP credential authenticated and was privately bound. One controlled production message was accepted with SMTP 250 and received at the approved Gmail address. SPF, DKIM, and DMARC passed; TLS 1.3, noreply Return-Path, support Reply-To, and the unmonitored-mailbox notice were verified. No invalid-recipient bounce was authorized.
- A temporary synthetic administrator reached the protected admin home, events, event-report moderation, category management, and operations routes. A temporary synthetic church editor reached portal, event dashboard, event creation, church edit, and team routes and was denied platform admin. All temporary Auth users, profiles, representative/audit documents, and the temporary representative-activity value were removed or restored.
- Public DNS returns the required `www` A/TXT values. App Hosting reports `HOST_ACTIVE`, `OWNERSHIP_ACTIVE`, and `CERT_ACTIVE` with reconciliation complete; `/`, `/churches`, and `/community-events` preserve their path through HTTPS 308 redirects to the canonical host.
- Daily and weekly Firestore schedules remain configured, but the managed-backup list still contains zero artifacts. PITR restore evidence does not replace the required first managed-backup restore.

That recommendation is superseded by the owner closure addendum below.

## Owner Blocker Closure Addendum — July 14, 2026

The current recommendation is **CONDITIONAL GO for a controlled production deployment window**. It is not authorization to merge, deploy further, enable Scheduler, or open registrations.

- Native accessibility: the launch owner explicitly reported the documented hosted-staging Windows Narrator/Chrome listening matrix as passed. No critical or high native-reader finding was reported; this is owner-supplied manual evidence.
- Dependency risk: the launch owner explicitly accepted all 9 moderate advisory nodes with the documented controls and August 14, 2026 remediation target. The audit has 0 high and 0 critical advisories.
- Backup: a current export completed at `gs://findyourchurch-24562-firestore-backups/exports/prelaunch-20260714T203054Z`. Isolated database `recovery-export-20260714-2031` imported it successfully; aggregation counts matched 42 churches and 1 location, representative records matched, and the recovery database was removed. The protected export remains. The first scheduled managed-backup artifact is still expected and should receive a follow-up restore when available.
- Email: guarded provider session `20260714-154026` sent all 15 Community Hub templates exactly once to the approved Gmail mailbox. Gmail received all 15. PDF and XLSX attachments were retrieved and parsed; SPF, DKIM, DMARC, TLS 1.3, Return-Path, support Reply-To, and the unmonitored notice passed. A reserved `.invalid` recipient was rejected synchronously with sanitized SMTP 550.
- Scheduler: `cloudscheduler.googleapis.com` is enabled in project `findyourchurch-24562`. Job `community-hub-registration-jobs-production` is paused, runs `*/15 * * * *` in `America/Chicago`, targets the canonical production registration-jobs endpoint, and has 3 provider retries. Unauthorized access returned 401; two authorized empty runs returned 200 with no duplicate work. Do not enable it before launch approval.
- Cost: Google Cloud Scheduler includes 3 jobs per billing account per month at no charge; additional jobs are USD 0.10/job/month. Paused jobs count, and downstream App Hosting, Firestore, Storage, and email usage is billed separately. See [Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing).

## Premium production launch candidate — July 14-15, 2026

Decision: **GO for the controlled production deployment window**. This is not permission to skip rollback gates: keep the production Scheduler paused and do not open registration automation until the new revision passes public, representative, administrator, email, App Check, and Scheduler smoke checks.

Release evidence:

- Premium public, directory, events, representative, and admin styling is live in staging on revision `community-hub-staging-build-2026-07-14-023` with the established green/gold brand preserved.
- Branded email, PDF, and XLSX output includes the free-service statement, optional El Roi Digital Ministries support message, canonical `https://elroidigital.org/donate.html` link, support Reply-To, and exact unmonitored-mailbox notice.
- Chromium, installed Edge, and Firefox: 194 passed, 0 failed, 1 intentional evidence skip. WebKit: 69 matrix passes plus five consecutive passes of the sole hydration-timing regression after synchronization; all functional cases now have passing evidence.
- 84 combined hosted axe scans have no critical or serious violation. Seven viewports, authenticated phone layouts, keyboard/focus behaviors, and 200 percent reflow pass.
- TypeScript, event/directory/registration/report/Scheduler/platform/staging/SEO suites, lint, 40-page staging production build, registration emulator, Firestore rules, Storage rules, combined Auth/security emulation, live staging Storage, hosted smoke, admin operations, and Scheduler security pass.
- Production preflight reverified project `findyourchurch-24562` / number `443706380375`, database `findyourchurchpal` in `nam5`, PITR and delete protection, 27 `READY` indexes, two backup schedules, seven-day Storage soft delete, canonical 200 responses, path-preserving `www` 308, and paused Scheduler.
- Audit remains the owner-accepted 9 moderate, 0 high, 0 critical production advisory nodes with the documented August 14, 2026 remediation target.
- The protected current export/import recovery proof remains the accepted backup gate. Restoring the first scheduled managed-backup artifact after it appears remains an operational follow-up.

Rollback immediately on environment mismatch, cross-church/private-data exposure, App Check rejection of valid clients, existing-site regression, capacity/counter inconsistency, missing email confirmation, duplicate Scheduler/email behavior, broken exports, or unavailable monitoring.

Remaining conditions are release actions rather than unresolved owner-risk decisions: approve and merge the reviewed branch, deploy and verify committed Firestore/Storage rules against explicit production identifiers, run controlled public/representative/admin/registration/email/Scheduler smoke, confirm monitoring, then explicitly enable the paused job and open registrations. Roll back immediately on an isolation failure, counter drift/oversubscription, configuration mismatch, required-email failure, or loss of monitoring.

Focused recertification after the closure changes passed TypeScript; event validation; directory routing; registration validation, reports, Scheduler, and Scheduler security; platform launch readiness; staging guards; 15-template email rendering/attachment/redaction; performance/SEO; lint; the 40-page production build; Firestore/Storage/Auth emulator rules; registration emulator capacity/idempotency/waitlist/pagination/retention; live staging Storage; hosted staging public smoke; hosted Scheduler auth; and `git diff --check`. The audit recheck reports 346 production dependencies and exactly 9 moderate, 0 high, and 0 critical advisory nodes. The emulator launcher initially lacked Java on `PATH`; the installed Android Studio OpenJDK 21 runtime was added to that command's process environment and both emulator suites then passed.

At that prelaunch checkpoint, the production Rules API readback was unavailable to the then-current CLI identity with HTTP 403. The authorized release window later deployed the reviewed `firestore.rules` and `storage.rules` to verified project `findyourchurch-24562` / database `findyourchurchpal`; the production closure below supersedes this historical gate.

## Premium Production Launch Decision — July 15, 2026

Decision: **GO**. The owner authorized the full production release after the controlled-window gates passed. This supersedes the conditional deployment-window decision above. It does not remove rollback triggers, the observation window, or the scheduled-backup follow-up.

Production evidence:

- App Hosting revision `findyourchurch-palacios-build-2026-07-15-001` serves the premium green/gold release at `https://findyourchurchpalacios.org`. Eleven canonical public/policy/login/SEO endpoints returned HTTP 200, the sitemap contained 50 public URLs with no portal/admin/register/manage/token paths, and `www` returned a path-preserving HTTPS 308.
- Firestore rules, Storage rules, and indexes were deployed only to explicit project `findyourchurch-24562` / database `findyourchurchpal`. The first index reconciliation removed four TTL field overrides because they were absent from the repository index definition; the release stopped, immediately restored all four policies to `ACTIVE`, and committed the exact overrides to `firestore.indexes.json`. All 27 composite indexes are `READY` and the four TTL policies remain `ACTIVE`.
- The new revision has zero Cloud Run error entries in the verification window. Warm canonical homepage, directory, and event responses completed in approximately 0.2–0.4 seconds from the release client.
- App Check valid-client proof passed in a real browser: the production exchange returned HTTP 200 and representative sign-in succeeded. Headless/unattested Authentication was rejected, confirming enforcement without blocking the verified client.
- A disposable production representative completed portal navigation, event draft privacy, flyer upload, event publication, registration-form activation, one capacity-counted registration, confirmation/management-link generation, dashboard/detail access, reversible check-in, and private PDF/XLSX downloads. A separate disposable administrator opened platform event, moderation, category, and operations routes; the representative remained denied from platform administration. Every disposable Auth, profile, representative, church, event, registration, form, token, counter, export, scheduled-job, flyer, and private-export record was deleted and verified absent.
- Production email session `premium-launch-20260715` sent all 15 branded templates to the one approved Gmail mailbox: 15 accepted, 0 rejected by the approved send, and 15 received. Gmail verified SPF, DKIM, DMARC, noreply Return-Path, support Reply-To, the universal unmonitored notice, canonical production links, no staging links, and El Roi Digital Ministries/donation branding. PDF and XLSX attachments opened and contained the same branding. A reserved invalid-domain failure remained sanitized. The live controlled registration confirmation and administrator notification also arrived with SPF/DKIM/DMARC passes.
- Scheduler endpoint probes returned 401 without/with invalid authentication, 400 for the wrong environment, and 200 for two authorized repeat runs with zero due/failed/duplicate work. Cloud Logging recorded both. Job `community-hub-registration-jobs-production` is now `ENABLED`; its first automatic `*/15` production invocation completed on the new revision with zero failures.
- Google Cloud Monitoring has 13 enabled alert policies, 3 enabled email channels, and one canonical HTTPS uptime check. The premium copy made the old content matcher stale; it was removed so availability is measured by canonical HTTPS 200, and fresh checker points pass. Cloud Logging and Error Reporting APIs remain enabled.
- Firestore PITR/delete protection, daily 14-day and weekly 84-day schedules, the protected export/import recovery proof, and Storage seven-day soft delete remain active. No scheduled managed-backup artifact exists yet, so its isolated restore remains a required operational follow-up rather than completed evidence.
- The production dependency audit remains the owner-accepted 9 moderate, 0 high, 0 critical nodes through the August 14, 2026 remediation target. The owner-reported Narrator/Chrome listening matrix remains the native-reader launch evidence.

Launch observation must roll back or close registrations on any environment mismatch, private/cross-church exposure, capacity drift, missing required email, duplicate Scheduler/email work, valid-client App Check rejection, broken export, sustained 5xx/unavailability, or loss of monitoring. The premium branch was not merged to `main` and was not pushed by this release task.

## Guarded Live Production Acceptance Rerun — July 15, 2026

Decision: **GO / live with active observation**. App Hosting build `build-2026-07-15-008` is ready and its rollout succeeded from application commit `bdf4849b9afff92bf89605f7d84944db8cda52c7`. Branch head `3c54cb718b3887d5430ca4def5c8d7b53fb9933f` adds only the final acceptance-harness cleanup locator. The branch is pushed; `main` remains unchanged.

- Two independent guarded production sessions, `20260715120811` and `20260715121238`, each passed all 8 serial workflow stages. Each run started with unused fictitious aliases, registered a temporary App Check debug token, and revoked that token in its finalizer.
- Each run exercised public submission and publication; administrator review; church claim and approval; primary-owner access; editor invitation and activation; editor/admin isolation; event creation, flyer upload, publication, and editor update; Simple RSVP initialization; capacity and waitlist; cancellation promotion; check-in; private PDF/XLSX exports; report email; platform administration; supported UI cleanup; and exact backstop cleanup.
- The exact cleanup verifier passed independently after both successful sessions. Test Auth users, church submissions, churches, claims, representatives, events, registrations, tokens, exports, scheduled jobs, flyers, and private files were absent after cleanup.
- Nineteen deliberate screenshots per successful run cover desktop and 375-pixel mobile public, representative, check-in, waitlist, and administrator views. Visual review found the green/gold branding readable and contained without horizontal overflow. The generated PDF and XLSX files opened and had valid signatures.
- Live defects found during the acceptance iterations were corrected and deployed: public flyer rendering and mobile containment, event-detail grid overflow, missing default Simple RSVP fields, and duplicate/missing portal/admin page-heading semantics.
- Provider SMTP accepted the controlled workflow messages and report attachments. The owner confirmed that the four approved alias inboxes receive the messages. The additional alias-to-`michaelgatica@elroidigital.org`-to-Gmail forwarding chain did not deliver a unique controlled marker and remains a Namecheap/Jellyfish/PrivateEmail forwarding configuration issue, not an application-send failure.
- Final regression results: TypeScript, lint, event validation, directory routing, registration validation, report generation, Scheduler behavior/security, platform launch readiness, staging guards, performance/SEO, Firestore rules, Storage rules, registration emulator, build, and `git diff --check` passed. The production audit reports 9 moderate, 0 high, and 0 critical advisories under the existing owner acceptance and August 14, 2026 remediation target.

Continue active observation. Repair and retest the external forwarding chain so Michael receives consolidated copies in Gmail; application delivery to the destination alias inboxes is already owner-confirmed.

### Forwarding correction recheck — July 15, 2026

- Guarded production session `20260715130231` passed all 8 workflow stages in 2.4 minutes. Its temporary App Check token was revoked and the exact cleanup verifier confirmed that no fixture remained.
- A new uniquely marked SMTP message was accepted with zero rejections for each of the four approved role aliases. Gmail did not contain that exact marker after multiple delivery windows.
- A separate uniquely marked message sent directly to `michaelgatica@elroidigital.org` arrived in Gmail. The same production session's pending-listing and pending-claim messages addressed to `support@elroidigital.org` also arrived.
- Result: application sending and the `elroidigital.org` to Gmail forwarding hop pass. The remaining failure is isolated to the first forwarding hop from the four Jellyfish-hosted role aliases to `michaelgatica@elroidigital.org`.
