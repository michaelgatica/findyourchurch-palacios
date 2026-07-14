# Community Ministry Hub Staging QA

This runbook is for validating Community Ministry Hub in a nonproduction environment only. Do not connect staging or preview UI to production Firebase, production SMTP jobs, or real church registration data.

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

## Manual QA Matrix

Record each item as `Pass`, `Fail`, `Not tested`, or `Blocked`.

| Area | Workflow | Browser | Viewport | Result | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Public | Homepage events section | Chrome | 375px | Not tested | Requires staging URL |  |
| Public | `/events` filter and event detail | Chrome | Desktop | Not tested | Requires staging URL |  |
| Public | Event report form | Chrome | Desktop | Not tested | Requires staging URL |  |
| Public | Registration submit and confirmation | Chrome | Desktop | Not tested | Requires staging URL |  |
| Public | Management link edit/cancel | Chrome | Desktop | Not tested | Requires staging URL |  |
| Church rep | Create, draft, publish, edit event | Chrome | Desktop | Not tested | Requires staging auth |  |
| Church rep | Upload valid and invalid flyer | Chrome | Desktop | Not tested | Requires staging storage |  |
| Church rep | Registration dashboard and check-in | Chrome | Desktop | Not tested | Requires staging auth |  |
| Church rep | PDF/XLSX export download | Chrome | Desktop | Not tested | Requires staging storage |  |
| Platform admin | `/admin/events` moderation actions | Chrome | Desktop | Not tested | Requires staging admin auth |  |
| Platform admin | `/admin/event-reports` review | Chrome | Desktop | Not tested | Requires staging admin auth |  |
| Platform admin | `/admin/event-categories` manage category | Chrome | Desktop | Not tested | Requires staging admin auth |  |
| Platform admin | `/admin/ops` config review | Chrome | Desktop | Not tested | Requires staging admin auth |  |
| Regression | Church directory, submit, claim, donation links | Chrome | Desktop/mobile | Not tested | Requires staging URL |  |

Do not mark Safari/WebKit as passed unless actually tested.

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
- Deterministic seed: 5 fictitious Auth users and 72 marked Firestore documents created.
- Firebase Storage bucket: `findyourchurch-staging-2026.firebasestorage.app` in `US-CENTRAL1`.
- Storage rules: compiled and released to the staging bucket.
- Hosting: Firebase App Hosting backend `community-hub-staging` in `us-central1`, environment `staging`, runtime `nodejs22`.
- Hosted URL: `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app`.
- App Hosting rollout: the focused SMTP/scheduler local-source rollout succeeded on July 13, 2026.
- Secret Manager: staging-only Firebase client key, registration-token, export-signing, and scheduler-token secrets are connected to the backend. Secret values are not stored in Git.
- Reset proof: live dry run finds all 72 marked/prefixed documents; no live reset was executed.
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
- Full responsive, accessibility, cross-browser, performance, email-delivery, and detailed manual QA remain intentionally unperformed.
- A QA owner must receive the current password through an approved private channel.

Current recommendation: **still blocked** for full staging certification because SMTP delivery is unavailable. The hosted application, Auth, Firestore, Storage, and scheduler are ready for the intentionally separate manual accessibility and browser QA phase after the SMTP owner supplies the missing private configuration.

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

Earlier local/emulator evidence retained from the staging-readiness phase:

Executed locally in the Firebase Emulator Suite:

- `npm run seed:community-hub-staging -- --dry-run`: passed with 3 churches, 7 events, 18 registrations, and 72 planned Firestore writes.
- `npm run seed:community-hub-staging -- --dry-run --large`: passed with 107 events, 1,112 registrations, and 2,760 planned Firestore writes.
- Emulator seed/reset round trip: passed with 5 Auth users and 72 Firestore documents created, then 5 Auth users and 72 Firestore documents deleted.
