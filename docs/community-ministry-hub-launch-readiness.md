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
- `EMAIL_FROM=support@findyourchurchpalacios.org`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD`.
- `SMTP_REPLY_TO` recommended.
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

- Registration retention is configured per event registration setup.
- Export retention is 24 hours.
- Access tokens expire and cleanup jobs remove expired records.
- Audit records should keep minimal metadata and avoid answer values.

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

Remaining advisories after `npm audit --omit=dev`:

- 11 moderate advisories.
- Next/PostCSS advisory remains reported by npm audit, with `npm audit fix --force` suggesting an unsafe downgrade path.
- Firebase Admin transitive `uuid` advisories remain through Google Cloud dependencies.
- `npm audit fix --omit=dev --dry-run` did not produce a safe production remediation path; it still left the same 11 moderate advisories and pointed to force-level/breaking changes.

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
- `npm audit --omit=dev`: completed with 11 moderate advisories.
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
| Dependency advisories | Documented | Yes audit | N/A | N/A | Yes | `npm audit --omit=dev --json`, security acceptance doc | 11 moderate advisories need owner acceptance |
| Monitoring | Ops visibility and correlation logs | Partial | Yes for scheduler success/failure | Yes | Yes | `/admin/ops`, Cloud Scheduler/Application logs | Recommended failure alerts remain unconfigured |
| Backup | Documented | No | No | No | Yes | Rollback/deployment docs | Needs managed backup confirmation |
| Rollback | Documented | No | No exercise | No | Yes | `docs/community-ministry-hub-rollback.md` | Needs nonproduction exercise |
| Existing church workflows | Existing tests pass | Partial | No staging browser | No | Yes | directory routing/build/regression tests | Needs staging regression pass |

The current evidence supports `CONDITIONAL GO` only. Full `GO` remains blocked until staging SMTP delivery, native screen-reader/WebKit evidence, and production-owner risk acceptance are completed. Scheduler, hosted cleanup, browser/accessibility, performance, SEO, and report-generation staging evidence are complete.

## Final Recommendation

Current recommendation: `CONDITIONAL GO`.

Reasons:

- Automated tests and rules checks can validate the core architecture.
- Platform admin moderation/category/config surfaces now exist.
- Live staging SMTP, production scheduler/App Check, accessibility, and manual browser QA still need environment-backed verification.
- Remaining dependency advisories require explicit acceptance or future upstream-safe updates.

Focused SMTP/scheduler recommendation on July 13, 2026: **Still blocked**. The blocker is limited to the absent approved staging SMTP provider credentials, sender/reply-to configuration, administrator recipient, and QA-owned `TEST_EMAIL_TO`. Cloud Scheduler is enabled and certified in staging; no production scheduler or deployment was created.
## Performance And SEO Validation Addendum — July 14, 2026

- Hosted large-data validation passed with 131 events, 1,125 registrations, and 500 registrations on one event.
- Public response start was 97–246 ms and public DOM-ready was 159–460 ms in Chromium. The 500-registration dashboard was DOM-ready in 968 ms and rendered 25 rows; platform event administration was DOM-ready in 519 ms and rendered 50 rows.
- All 25 staging composite indexes remain ready. No index change is required for current application query shapes.
- Public event queries remain published/public/previously-published and bounded. Registration queries are event/church scoped; admin events and reports now cursor-page at 50. Directory filter values reuse the already loaded bounded church result.
- Six 500-registration PDFs completed in 2.122–3.545 seconds and 175–203 kB; XLSX completed in 2.027 seconds and 62 kB with correct rows, totals, participant/answer-summary sheets, long text, and formula protection.
- The operating limits and detailed measurements are recorded in `docs/community-ministry-hub-staging-qa.md`.
- Staging uses its own canonical origin and global `noindex`. The production decision remains the non-`www` HTTPS host `https://findyourchurchpalacios.org`; alternate/default domains must redirect after configuration is confirmed.
- Sitemap, structured Event data, Open Graph metadata, unlisted privacy, token non-disclosure, Google Calendar, and ICS tests passed.

Recommendation remains **still blocked** for full staging certification because provider-backed SMTP delivery, native screen-reader evidence, and WebKit/Safari evidence remain unavailable. This addendum is not production approval.
