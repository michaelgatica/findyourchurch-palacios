# Community Ministry Hub Staging QA

This runbook is for validating Community Ministry Hub in a nonproduction environment only. Do not connect staging or preview UI to production Firebase, production SMTP jobs, or real church registration data.

## Performance And SEO Checkpoint — July 14, 2026

- Target: Firebase project `findyourchurch-staging-2026`, Firestore database `findyourchurchpal`, App Hosting backend `community-hub-staging`, and `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app` only.
- Dataset after the staging-safe `--dry-run --large` / `--confirm --large` sequence: 3 churches, 131 total event documents, 119 public-event projections, 1,125 registrations, and exactly 500 registrations for `staging-qa-event-full`. All records are fictitious. The deterministic manifest itself contains 109 events, 1,112 registrations, and 2,763 writes; the difference is retained staging-only browser-QA fixtures.
- Public Chromium warm measurements: homepage 246 ms response start / 460 ms DOM-ready; directory 97/159 ms; event listing 110/337 ms; event detail 112/195 ms; church profile 102/241 ms. A final zero-instance cold homepage request measured 3.623 s response start / 4.068 s DOM-ready; this is the documented cost-controlled staging behavior with `minInstances: 0`, not the expected warm baseline. Each warm route used 21–33 browser resources and about 232–866 kB measured transfer. The large event listing deliberately renders at most 60 upcoming public events. The disabled donation integration no longer loads its third-party modal script in staging.
- Authenticated measurements: the 500-registration dashboard was 198 ms response start / 968 ms DOM-ready with 25 rows; platform event administration was 179/519 ms with 50 rows. Measured Chromium heap was about 10 MB. Registration cursor paging, prefix/exact search, status filtering, check-in bounding, admin next-page behavior, event reports, categories, and operational logs passed.
- Firestore: all 25 deployed composite indexes remain `READY`; no index was added. Public queries require published/public/previously-published constraints. Church/event/registration/admin queries are scoped and bounded. The directory no longer performs a duplicate published-church read. Admin events and reports now use 50-record cursor pages.
- Capacity: the emulator accepted 12 simultaneous distinct submissions against capacity 5 plus waitlist 7 as exactly 5 confirmed and 7 waitlisted. Cancelling one confirmed registration promoted one waitlisted registration and preserved aggregate counts. Existing atomic tests also passed final-slot contention, repeated idempotency keys, rate limiting, cancellation, promotion, and cursor paging without oversubscription.
- Exports at 500 registrations: roster PDF portrait 3.545 s / 175,498 bytes / 127 pages; roster landscape 2.439 s / 196,310 bytes / 168 pages; sign-in portrait 2.304 s / 181,220 bytes / 127 pages; sign-in landscape 2.279 s / 202,737 bytes / 169 pages; check-in portrait 2.310 s / 179,545 bytes / 127 pages; check-in landscape 2.122 s / 200,457 bytes / 169 pages. XLSX took 2.027 s and was 62,227 bytes with 501 registration rows, 833 participant rows, correct totals, Participants and Answer Summary sheets, long-text handling, and formula-injection neutralization. Private exports still expire after 24 hours.
- Scheduler scale: due-job selection remains 25; notification writes run in batches of 25; retention deletion runs in batches of 400; expired export selection is at most 100 and access-token cleanup at most 400. Hosted certification completed five independent jobs while one controlled failure retried, verified overlap suppression, reminder fan-out, duplicate suppression, cleanup, retention, cross-church isolation, resumability, and operational logs.

Supported operating limits:

| Area | Supported limit |
| --- | --- |
| Registration dashboard | 25 rows by default; repository hard maximum 100 rows per cursor page |
| Platform events and event reports | 50 rows per cursor page; repository hard maximum 100 |
| Platform event keyword/city/mode search | 50-row result page; at most 500 ordered event documents scanned in 50-document batches per request |
| Church portal event list | 50 most recent scoped events |
| Public upcoming-event list | 60 events per rendered listing |
| Published churches | 500 per market query |
| Sitemap upcoming events | 1,000 |
| Registrations per export | 1,000 hard maximum; 500 load-certified in hosted staging |
| Generated export | 10 MB; private 24-hour expiration |
| Participants per registration | 25 |
| Registration form | 20 sections, 100 top-level fields, 30 participant subfields per repeating field |
| Long-text answer | 5,000 characters per configured field; total answer payload 150 kB |
| Flyer | 8 MB; 400x300 minimum through 6000x6000 maximum; JPG, PNG, or WebP |

SEO and discovery policy verified in hosted staging:

- Staging canonical and Open Graph URLs use the staging host and never claim the production domain. All staging pages emit `noindex`; staging `robots.txt` disallows `/`.
- The intended production canonical origin is `https://findyourchurchpalacios.org` (non-`www`). `www.findyourchurchpalacios.org` and Firebase default domains must redirect to it once production domain configuration is confirmed. `findyourchurch.org` is not treated as active for this launch.
- Sitemap includes published churches and upcoming published public events. Draft, pending-review, unlisted, cancelled, past, registration, confirmation, management-token, portal, admin, and export-token routes are excluded. Past published event detail may remain canonical/indexable in production, but past events are omitted from the upcoming sitemap. Cancelled pages are direct/noindex and carry `EventCancelled` structured data; unlisted pages are direct/noindex and emit no structured data.
- Event JSON-LD, title, description, canonical, Open Graph title/description/URL/image, flyer dimensions/alt text, and staging robots passed. Absolute Storage flyer URLs are preserved instead of being double-prefixed.
- Unlisted fixtures were absent from homepage, calendar, church upcoming sections, public search, broad public enumeration, and sitemap. Firestore rules still permit only the intended exact direct read. Test token values were absent from canonical URLs, sitemap, JSON-LD, Open Graph, and ICS output.
- Google Calendar and ICS actions contain the correct UTC start/end, `America/Chicago` timezone context, venue, staging public URL, and cancellation state. ICS responses are `text/calendar`, attachment-only, and `noindex`.

Validation commands passed: `test:staging-performance-seo` (5/5), hosted smoke, static performance/SEO/calendar tests, TypeScript, event/directory/registration/report/scheduler/scheduler-security/platform/staging suites, Firestore/Storage/Auth rules, registration emulator load tests, live staging Storage, scheduler certification, lint, staging-configured production build, and `git diff --check`.

Performance/SEO recommendation at that checkpoint: **still blocked from full staging certification** by the already documented absence of provider-backed SMTP delivery and unavailable native assistive-technology/browser evidence. Performance, query, export, sitemap, structured-data, Open Graph, unlisted privacy, and calendar validation themselves are complete. The final matrix later passed Playwright WebKit.

## Branch And Scope

- Base commit: `339320f`.
- Hosted-staging branch: `feature/community-hub-hosted-staging`.
- Production deployment: not performed.
- Production data mutation: not allowed.
- Push status: local only; no branch or commit has been pushed.

## Environment Options

Preferred order:

1. Dedicated Firebase staging project.
2. Firebase Hosting preview channel connected only to staging Firebase services.
3. Local Firebase Emulator Suite with browser-accessible Next.js app.

Minimum safe staging variables:

```bash
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_SITE_URL=<staging-or-preview-url>
FIREBASE_PROJECT_ID=<nonproduction-project>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<nonproduction-project>
FIREBASE_STORAGE_BUCKET=<nonproduction-bucket>
EMAIL_PROVIDER=console
REGISTRATION_TOKEN_SECRET=<staging-only-secret>
REGISTRATION_JOBS_CRON_SECRET=<staging-only-secret>
STAGING_TEST_USER_PASSWORD=<temporary-test-password>
PRODUCTION_FIREBASE_PROJECT_ID=findyourchurch-24562
```

For emulator-only validation:

```bash
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8180
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
FIREBASE_PROJECT_ID=demo-find-your-church-staging
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-find-your-church-staging
```

The authenticated admin and representative portal areas display a visible nonproduction banner whenever `APP_ENV` is not `production`.

Dedicated staging selectors:

- `.firebaserc` keeps production as the default and adds the explicit `staging` alias for `findyourchurch-staging-2026`.
- `firebase.staging.json` pins Firestore rules and indexes to the named database `findyourchurchpal`.
- `.env.staging.example` contains the non-secret staging shape; copy it to ignored `.env.staging.local` and add the web API key and staging-only secrets locally.
- Use an explicit project and named-database selector for every deploy. Do not deploy staging through the default alias.

The seed/reset tools also accept a short-lived `FIREBASE_OAUTH_ACCESS_TOKEN` when no staging service-account key is available. This path verifies the nonproduction project and live named database before each Auth or Firestore write. Never commit or log the token.

## Deterministic Test Data

Dry run:

```bash
npm run seed:community-hub-staging -- --dry-run
```

Seed staging:

```bash
npm run seed:community-hub-staging -- --confirm
```

Seed larger performance data:

```bash
npm run seed:community-hub-staging -- --confirm --large
```

Reset dry run:

```bash
npm run reset:community-hub-staging -- --dry-run
```

Reset confirmed:

```bash
npm run reset:community-hub-staging -- --confirm
```

The seed includes three fictitious churches, one platform admin, one representative per church, one limited event manager represented as a church editor, draft/published/unlisted/cancelled/full/waitlist/external-registration events, a flyer placeholder, internal form versions, registrations in all supported statuses, a public report, and an operational event. The `--large` option adds 100 load events and 500 registrations for performance testing.

Seed and reset commands refuse:

- `APP_ENV=production`.
- Known production project `findyourchurch-24562`.
- Canonical production host `https://findyourchurchpalacios.org`.

## Accessibility, Browser, And Viewport Matrix

Hosted browser evidence recorded July 14, 2026. `Pass` means the route/workflow completed on the real staging URL; unavailable engines are not inferred from another browser.

| Route or workflow | Browser | Viewport | Result | Finding, fix, or limitation |
| --- | --- | --- | --- | --- |
| Public home, directory/map, event filter/detail/flyer/cancellation | Chromium | 1280x720 | Pass | Published/draft/unlisted behavior and flyer/fallback state passed. |
| Public custom registration, repeating participant, confirmation, management, cancellation | Chromium | 1280x720 | Pass | A fictitious registration was created, managed, and cancelled. |
| Representative create draft, upload flyer, publish, form builder, registrations, check-in, PDF/XLSX | Chromium | 1280x720 | Pass | Real staging-only mutation and both secure downloads passed. |
| Representative Church B and limited-manager authorization | Chromium | 1280x720 | Pass | Church A/B data stayed isolated; manager remained outside platform admin. |
| Platform event filter/lock, report moderation, category, operations | Chromium | 1280x720 | Pass | Editing lock was toggled and restored; all admin surfaces remained usable. |
| All public and role workflows above | Microsoft Edge | 1280x720 | Pass | Same workflow coverage passed with the installed Edge channel. |
| All public and role workflows above | Firefox | 1280x720 | Pass | Multipart editor redirect defect was fixed. Exact `Connection closed.` RSC errors or React 419 client-render recovery can still appear after successful representative navigation; state and navigation pass, and the medium issue is documented. |
| `/`, `/events`, published event, registration | Chromium | 320, 375, 430, 768, 1024, 1366, 1920 | Pass | No horizontal page overflow. |
| `/`, `/events`, published event, registration | Edge | 320, 375, 430, 768, 1024, 1366, 1920 | Pass | No horizontal page overflow. |
| `/`, `/events`, published event, registration | Firefox | 320, 375, 430, 768, 1024, 1366, 1920 | Pass | Initial 320px admin overflow fixed; final matrix passed. |
| Representative registration/form-builder/check-in/export | Chromium, Edge, Firefox | 320x720 | Pass | Controls remain reachable; tables/cards and forms fit the viewport. |
| Platform events/reports/categories/operations | Chromium, Edge, Firefox | 320x720 | Pass | Admin surfaces wrap without horizontal page overflow. |
| Registration reflow | Chromium, Edge, Firefox | 1024x768 at 200% | Pass | No information/control loss or horizontal page overflow. |
| Standalone Google Chrome | Chrome | All | Not tested | Browser unavailable in this environment; Chromium was tested separately. |
| WebKit/Safari equivalent | Playwright WebKit | All hosted suite routes/workflows | Pass | Authoritative final run passed; native Safari hardware was unavailable. |

The authoritative final run completed 63 axe route/state scans across Chromium, Firefox, and WebKit with no critical or serious violations after fixes; the earlier installed-Edge evidence also passed. Native screen-reader software was unavailable; semantics were reviewed through axe, the accessibility tree/DOM, and keyboard operation.

## Focused Hosted Smoke Test

Hosted staging URL: `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app`

This checkpoint intentionally covered only the minimum hosted infrastructure and core workflows. It is not the full manual QA, responsive, accessibility, cross-browser, or performance matrix.

| Area | Exact URL or action | Result | Evidence and notes |
| --- | --- | --- | --- |
| Public | `/` | Pass | Homepage rendered with Find Your Church content and staging canonical metadata. |
| Public | `/churches` | Pass | Directory rendered the three fictitious staging churches. |
| Public | `/events` | Pass | Published events rendered; draft, unlisted, and cancelled fixtures remained absent from the listing. |
| Public | `/events/staging-published-family-night` | Pass | Published event detail opened. |
| Public | `/events/staging-draft-community-meal` | Pass | Returned the not-found experience without exposing draft content. |
| Public | `/events/staging-unlisted-volunteer-training` | Pass | Direct unlisted link opened as designed. |
| Public | `/events/staging-cancelled-outreach` | Pass | Cancellation state and message rendered. |
| Public | `/events/staging-full-capacity-workshop` | Pass | Event without a flyer rendered its content without a broken event image. |
| Church representative | `/portal/events` | Pass | Church A representative signed in and opened the owned event list. |
| Church representative | Draft, flyer, publish | Pass | Created event `8596822f-7b7f-4895-84fd-e5a250bc926e`, uploaded a 1200x675 PNG through the trusted server flow, and published `/events/hosted-staging-smoke-event-2026-07-13`. |
| Church representative | `/portal/events/staging-qa-event-published/registration` | Pass | Existing fictitious registrations and counters rendered. |
| Church representative | Church B edit route | Pass | Church A received the not-found experience for `/portal/events/staging-qa-event-unlisted/edit`. |
| Church representative | `/admin/events` | Pass | Church A received an explicit admin access-denied page. |
| Platform administrator | `/admin/events` | Pass | Platform event administration opened. |
| Platform administrator | `/admin/event-reports` | Pass | Event reports opened. |
| Platform administrator | `/admin/event-categories` | Pass | Category management opened. |
| Platform administrator | `/admin/ops` | Pass | Operations readiness opened. |

The uploaded flyer loaded publicly from `findyourchurch-staging-2026.firebasestorage.app` at its expected 1200x675 dimensions. Browser screenshots were not captured because the in-app browser screenshot operation timed out; DOM, console, HTTP, and rendered-image state supplied the focused evidence for this run.

## Authorization Checklist

- Platform admin can access all admin Community Hub routes.
- Church A representative cannot access Church B event admin, registrations, exports, or flyers.
- Church B representative cannot access Church A private data.
- Limited event manager can manage assigned church events without platform admin privileges.
- Anonymous user can browse published public events and submit event reports only through server actions.
- Direct Firestore and Storage access denies private records and writes.

## SMTP Checklist

Staging SMTP remains blocked. Hosted staging intentionally uses `EMAIL_PROVIDER=console`, and no staging-safe SMTP or Resend credentials are configured locally or in Secret Manager. To use SMTP, configure `EMAIL_PROVIDER=smtp`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD`; `SMTP_REPLY_TO` and `TEST_EMAIL_TO` should also be set when applicable. The supported Resend alternative requires `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, and `RESEND_API_KEY`. Use only fictitious or approved staging recipients.

When available, send and inspect:

- Registration confirmation.
- Waitlist confirmation.
- Waitlist promotion.
- Registration cancellation.
- Event cancellation.
- Event reminder.
- Admin new-registration notification.
- Capacity reached.
- Registration closed.
- PDF report email.
- XLSX report email.
- Combined report email.
- Scheduled report.

## Scheduler Checklist

Use `REGISTRATION_JOBS_CRON_SECRET` and call the staging endpoint with `x-cron-secret`.

Verify:

- Unauthorized request returns denied response.
- Authorized request succeeds.
- Repeated run does not duplicate emails or reports.
- Failed job records status, attempts, and error.
- `/admin/ops` and operational logs expose failures.

Hosted scheduler certification result on July 13, 2026:

- Unauthenticated `POST /api/jobs/registration`: `401`.
- Invalid secret, public-session-without-secret, and representative-session-without-secret requests: `401`.
- Missing or incorrect `x-fyc-environment` marker: `400`; body-bearing request: `413`; unexpected `GET`: `405`.
- Authenticated staging-only calls returned `200`; competing calls produced a lease-controlled `202` overlap skip.
- Fictitious digest, reminder fan-out and reminder notice, registration-closing report, export cleanup, expired-token cleanup, and retention cleanup completed in hosted staging.
- A deliberately cross-church job failed ownership validation, recorded attempt 1, scheduled a retry, and completed on attempt 2 after its fixture was corrected.
- Immediate duplicate execution completed zero jobs and created zero duplicate email-log entries.
- Cloud Scheduler API is enabled. Job `community-hub-registration-jobs-staging` is enabled in `us-central1`, runs `*/15 * * * *` in `America/Chicago`, and calls the hosted endpoint with private authentication and staging-marker headers.
- The Cloud Scheduler job was run manually; its last-attempt status was clear. Scheduler and application logs were visible, and the secret was absent from inspected logs and 12 hosted client bundles.

## Current Staging Status

Live staging checkpoint recorded July 13, 2026:

- Firebase project: `findyourchurch-staging-2026`.
- Firebase web app: `Find Your Church Staging Web` (`1:286552720158:web:1ef2dc258ecc545106bf0f`).
- Firestore database: `findyourchurchpal`, Native mode, `nam5`.
- Authentication: initialized; Email/Password enabled with password required.
- Firestore rules: compiled and released to `findyourchurchpal`.
- Firestore indexes: 25 composite indexes deployed to `findyourchurchpal`; all 25 report `READY`.
- Deterministic large seed: 5 fictitious Auth users reused; current staging totals are 3 churches, 131 events, 119 public-event projections, and 1,125 registrations, including 500 on the load fixture.
- Firebase Storage bucket: `findyourchurch-staging-2026.firebasestorage.app` in `US-CENTRAL1`.
- Storage rules: compiled and released to the staging bucket.
- Hosting: Firebase App Hosting backend `community-hub-staging` in `us-central1`, environment `staging`, runtime `nodejs22`.
- Hosted URL: `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app`.
- Serving revision after the final correction: `community-hub-staging-build-2026-07-14-014` at 100 percent traffic.
- App Hosting rollout: the performance/query/SEO correction rollout succeeded on July 14, 2026; backend reconciliation is complete and the ICS route proves the new revision is serving.
- Secret Manager: staging-only Firebase client key, registration-token, export-signing, and scheduler-token secrets are connected to the backend. Secret values are not stored in Git.
- Reset proof: the earlier small-seed dry run found all 72 marked/prefixed documents. The current large dataset was intentionally retained for QA; no live reset was executed.
- Production project `findyourchurch-24562`: not deployed or mutated.

Deployed staging access checks passed:

- Anonymous published public-event read allowed.
- Anonymous unlisted direct-link event read allowed.
- Anonymous private event read denied.
- Church representative own user and representative records allowed.
- Cross-user and cross-representative reads denied.
- Church representative private registration read denied.
- Platform admin private registration read allowed.
- Three seeded Email/Password accounts signed in successfully during automated verification.

Automated validation passed in this checkpoint:

- TypeScript (`tsc --noEmit`).
- Event and directory routing validation.
- Registration validation, report/export generation, and scheduler tests.
- Platform launch-readiness and staging-guard tests.
- Firestore/Storage/Auth emulator security suite.
- Registration emulator suite.
- ESLint.
- Next.js production build with staging client values; the only production project reference in the output is the server-side safety guard.
- `git diff --check`.
- Live staging Storage access and trusted-upload smoke tests.
- Hosted public smoke script, including canonical, visibility, cancellation, fallback, and Storage flyer checks.
- Hosted Playwright/axe suite in Chromium, Edge, and Firefox, including keyboard, seven viewport widths, 200 percent reflow, role isolation, real event/flyer publication, check-in restoration, and PDF/XLSX download workflows.

QA account labels:

- Platform administrator: `staging-qa-admin@staging.findyourchurch.test`.
- Church A representative: `staging-qa-rep-user-1@staging.findyourchurch.test`.
- Church B representative: `staging-qa-rep-user-2@staging.findyourchurch.test`.
- Church C representative: `staging-qa-rep-user-3@staging.findyourchurch.test`.
- Limited event manager: `staging-qa-event-manager@staging.findyourchurch.test`.
- Public anonymous user: no account.

The shared QA-owned password was rotated after hosted testing and stored only as staging Secret Manager secret `FYC_STAGING_QA_PASSWORD`. The App Hosting runtime was not granted access. An authorized QA owner should retrieve it privately into the approved password manager, not paste it into shared terminal output, chat, documentation, or issue comments. To rotate it again, set `STAGING_TEST_USER_PASSWORD` only in ignored local configuration and run `npm run rotate:community-hub-staging-passwords`; never add the password to source or commits.

Remaining full-certification blockers:

- Staging SMTP/mail testing is not configured. `EMAIL_PROVIDER` remains `console`; no SMTP sender, administrator recipient, approved test recipient, or SMTP credentials were available locally or in staging Secret Manager.
- Actual delivery, provider message IDs, bounce behavior, sender/reply-to inspection, mailbox receipt, and emailed attachment receipt remain blocked until an approved staging SMTP account and test mailbox are supplied privately.
- Native screen-reader and provider-backed email delivery remain separate. Playwright WebKit passed in final certification; native Safari hardware was unavailable. Performance and SEO validation are complete.
- A QA owner must receive the current password through an approved private channel.

Historical checkpoint recommendation: **still blocked from full staging certification** because SMTP delivery and assistive-technology/browser evidence were incomplete. The final certification below supersedes this status; Playwright WebKit now passes, while SMTP and native screen-reader evidence remain blocked.

## SMTP and Scheduler Configuration Record

SMTP status:

- Active staging provider: `console`.
- Admin-only staging test surface: `/admin/ops`; verified with the fictitious platform-administrator account.
- The page lists 15 transactional/report templates, shows SMTP as blocked, does not display credentials or recipient addresses, and disables send controls until validation passes.
- A staging send requires `EMAIL_PROVIDER=smtp`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, exactly one `TEST_EMAIL_TO`, and `ALLOW_REAL_EMAIL_TEST=true`. `SMTP_REPLY_TO` is optional but validated when present.
- Recommended future Secret Manager names: `FYC_STAGING_EMAIL_FROM`, `FYC_STAGING_ADMIN_NOTIFICATION_EMAIL`, `FYC_STAGING_SMTP_HOST`, `FYC_STAGING_SMTP_PORT`, `FYC_STAGING_SMTP_USER`, `FYC_STAGING_SMTP_PASSWORD`, `FYC_STAGING_SMTP_REPLY_TO`, and `FYC_STAGING_TEST_EMAIL_TO`.
- Do not add those App Hosting references until the corresponding secrets exist and the QA owner has approved the single test recipient.
- Template/render tests passed for registration confirmation, simple RSVP, waitlist confirmation/promotion, registration update/cancellation, event cancellation/reminder, organizer/capacity/closing notifications, PDF, XLSX, combined reports, and scheduled digest. PDF/XLSX files opened locally. No live SMTP delivery was attempted or claimed.
- A local non-delivering SMTP connection failure verified credential, recipient, and sender-address redaction. Provider-backed failure recording, message IDs, and retry delivery remain blocked until staging SMTP credentials exist.

Scheduler status:

- API: `cloudscheduler.googleapis.com` enabled only in `findyourchurch-staging-2026`.
- Job: `community-hub-registration-jobs-staging`.
- Endpoint: `POST https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app/api/jobs/registration`.
- Schedule: `*/15 * * * *`; time zone: `America/Chicago`.
- Authentication: staging Secret Manager value sent as private `x-cron-secret` header plus `x-fyc-environment: staging`; no secret is committed or placed in the command line.
- Retry policy: 3 Cloud Scheduler retries, 30-second minimum backoff, 300-second maximum backoff, 900-second maximum retry duration; application jobs use 3 attempts with bounded exponential backoff.
- Application protection: 20-minute global run lease, per-job lease, stale-lease recovery, deterministic job IDs, delivery completion markers, terminal failure visibility, and correlation-linked operational events.
- Recommended alerts, not configured in this focused task: two consecutive dispatcher failures, two consecutive SMTP failures, and any terminal digest, reminder, report, export-cleanup, or retention-cleanup failure.

## Final Certification Checkpoint — July 14, 2026

- Project: `findyourchurch-staging-2026`; Firestore database: `findyourchurchpal`; Storage bucket: `findyourchurch-staging-2026.firebasestorage.app`.
- Hosted URL: `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app`.
- The final read-only performance snapshot contained 3 churches, 137 events, 125 public projections, 1,131 registrations, and exactly 500 registrations on the load/export fixture. The growth from the initial large seed is limited to fictitious records created by hosted workflow QA.
- App Hosting was redeployed only to the explicit staging project after a bounded admin-search defect was corrected. Search now scans at most 500 ordered event documents in 50-document batches and returns cursor pages; it no longer searches only the first page.
- Final hosted matrix: 209 passed, 0 failed, 1 intentional screenshot-evidence skip in 14.1 minutes across Chromium, Firefox, and Playwright WebKit. The earlier installed Microsoft Edge matrix also passed. Standalone Chrome, native Safari hardware, and a native screen reader were unavailable and are not marked passed.
- All 63 final axe route scans passed without critical or serious violations. Keyboard, focus return, first-error focus, labels, seven target viewport widths, 320px authenticated surfaces, and 200 percent reflow passed.
- Existing-site hosted regression passed in every final engine: homepage, directory count/filter, canonical and legacy church/claim routes, Submit Your Church, contact, privacy, terms, staging-disabled donation integration, mobile navigation, representative account/portal/edit, and existing platform church administration.
- Public, representative, limited-manager, cross-church, and platform-admin Community Hub workflows passed. PDF/XLSX generation, private download, check-in restore, report moderation, category management, and operations readiness passed.
- Staging Scheduler authentication, environment/method/body limits, correlation, lease/overlap, retry, idempotency, digest, reminder, closing report, export/token cleanup, registration retention, and operational logs passed. The job remained enabled after the pause/resume rollback control exercise.
- SMTP application behavior passed 15 template/render checks, PDF/XLSX attachment creation, one-recipient enforcement, and controlled-failure redaction. Provider delivery was not attempted because staging remains `EMAIL_PROVIDER=console`; receipt/sender/links/provider ID/bounce evidence is blocked.
- Rollback exercise passed by deploying compatible prior commit `1d5049b743ef4c5b49bcbe53d489c68beac4353e`, verifying public/authenticated data, restoring `8c0263274805d0e2818ee90e65c1fd76775c22de`, and reconciling the baseline. Core data counts were preserved; two expected scheduler operational events were added while the exercise ran.
- Staging has no managed Firestore backup schedule, and Storage versioning/retention/soft-delete protection was not confirmed. These are production launch gates, not a reason to mutate staging during this task.
- Production project `findyourchurch-24562`, production data, production rules, production Storage, production hosting, `main`, and remotes were not modified.

Final production recommendation: **NO-GO**. Hosted staging functionality is suitable for merge review, but production is blocked by provider-backed SMTP certification, explicit advisory/App Check/native-screen-reader risk acceptance, external monitoring/alert delivery, log-retention approval, production backup/Storage recovery, and deployment-window production configuration and smoke tests.

Earlier local/emulator evidence retained from the staging-readiness phase:

Executed locally in the Firebase Emulator Suite:

- `npm run seed:community-hub-staging -- --dry-run`: passed with 3 churches, 7 events, 18 registrations, and 72 planned Firestore writes.
- `npm run seed:community-hub-staging -- --dry-run --large`: passed with 107 events, 1,112 registrations, and 2,760 planned Firestore writes.
- Emulator seed/reset round trip: passed with 5 Auth users and 72 Firestore documents created, then 5 Auth users and 72 Firestore documents deleted.

## Production Blocker Closure Staging Record — July 14, 2026

This record supersedes the historical SMTP/monitoring/backup statements above while preserving them as dated evidence.

- Hosted URL remained `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app` and every external command explicitly targeted `findyourchurch-staging-2026`.
- Hosted SMTP used Namecheap Shared Hosting Mail with sender `noreply@findyourchurchpalacios.org`, Reply-To `support@findyourchurchpalacios.org`, and one approved staging recipient. The owner later directed that credential rotation be omitted; the credential still must be supplied privately and must never be copied into source or documentation.
- Seven controlled messages were received: registration confirmation, waitlist confirmation, event reminder, church-administrator notification, PDF report, XLSX report, and scheduled report. All expected messages appeared exactly once; PDF and XLSX opened.
- Received headers passed SPF, DKIM, and DMARC. DMARC policy remains monitoring-only (`p=none`). Staging links and the universal unmonitored-mailbox notice were present; prohibited sensitive answer categories were absent. A real invalid-recipient bounce was not sent.
- App Check reCAPTCHA Enterprise is registered to the staging web app and hosted domain. A first post-rollout probe did not observe the exchange while the revision propagated and failed; the subsequent authoritative probe loaded the provider and received HTTP 200 from the token exchange, with authenticated admin workflow success. Enforcement remains off in staging by design.
- Google Cloud Logging, Monitoring, and Error Reporting APIs are enabled. Operations has one HTTPS uptime check, 12 safe log metrics, 13 enabled alert policies, and three enabled email channels. A controlled staging warning reached the approved alert mailbox and contained no sensitive content.
- Firestore backup schedules: daily with 14-day retention and Sunday weekly with 12-week retention. No scheduled backup had completed at the checkpoint, so managed restore remains untested.
- Storage soft delete is seven days; versioning is off. One fictitious object was deleted, discovered as soft-deleted, restored, verified by hash/size, and cleaned up.
- Firestore TTL is active for `auditLogs`, `emailLogs`, `eventScheduledJobs`, and `operationalEvents`. The 605-record backfill affected only operational metadata. The authenticated `/admin/ops` smoke passed and verified retained summaries without recipient/body exposure.
- The staging Cloud Logging `_Default` bucket reports 30-day retention. Application records retain only the approved safe metadata for their longer Firestore TTL periods; production Cloud Logging retention must be rechecked during deployment preflight.
- Native screen-reader testing is still required and was not marked passed. Windows Narrator is present; NVDA and an auditable speech-output surface were unavailable in this run.
- Production project `findyourchurch-24562`, production data/rules/Storage/hosting/secrets, `main`, and remotes were not modified.

Staging blocker-closure recommendation: **NO-GO for production today** due to native screen-reader evidence, unaccepted dependency advisories, private production SMTP binding/bounce verification, first managed-backup/restore proof, App Check enforcement, required indexes, and passing production smoke tests. SMTP rotation is an owner-waived item, not a remaining gate.

### Blocker-closure recertification result

- TypeScript, event/directory/registration/report/Scheduler/platform/staging validation, Firestore/Storage emulator security, registration emulator, live Storage, hosted Scheduler, hosted smoke, App Check, performance/SEO, lint, and the staging-configured production build passed.
- The full hosted browser command executed 216 cases: 207 passed, 4 evidence-only cases skipped, and 5 initially failed. All accessibility/axe route scans passed; the five failures were workflow/performance harness cases, not axe violations.
- Three cancellation failures were caused by the new staging SMTP recipient guard correctly rejecting generated `.test` addresses. The QA wrapper was changed to load the one approved address from Secret Manager into process memory. Edge and Firefox then passed; Chromium passed on its clean targeted rerun.
- Two Edge/Firefox navigations reported transient `NS_BINDING_ABORTED`. A one-time retry limited to that browser error was added; both targeted reruns passed, with Chromium as a passing control.
- The first local build attempt exposed `/admin/ops` throwing when Firebase Admin was intentionally unavailable during prerender. Recent Scheduler summaries now return an empty list in that condition, matching audit/email behavior. TypeScript and the second 40-page build passed.
- The final staging rollout completed. Authenticated operations, public smoke, and App Check HTTP 200 exchange passed against the served revision.
- Native screen-reader testing did not run and remains launch-blocking.

## Production Remediation Follow-up — July 14, 2026

Staging certification remains unchanged. The later owner-authorized production remediation supplied the following deployment-window evidence without merging `main`:

- production App Hosting rollout succeeded from the remediation branch and public deep links pass;
- all 27 production indexes are `READY`;
- production App Check token exchange passed and Authentication, Firestore, and Storage are enforced;
- the SMTP secret is privately bound and a controlled production message was received with SPF/DKIM/DMARC pass, support Reply-To, noreply Return-Path, and the unmonitored notice;
- controlled synthetic representative and administrator route checks passed, then every synthetic record was removed or restored;
- the required `www` A/TXT records are publicly visible, App Hosting host/ownership/certificate state is active, and path-preserving HTTPS 308 redirects pass;
- no first scheduled managed backup exists yet, so a managed-backup restore still cannot run.

Native screen-reader evidence, dependency-risk acceptance, first managed-backup restore, and the SMTP bounce decision remain launch gates. This follow-up does not change the historical staging matrix or authorize opening production registrations.
