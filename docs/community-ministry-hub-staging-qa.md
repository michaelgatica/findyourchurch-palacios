# Community Ministry Hub Staging QA

This runbook is for validating Community Ministry Hub in a nonproduction environment only. Do not connect staging or preview UI to production Firebase, production SMTP jobs, or real church registration data.

## Branch And Scope

- Base commit: `e9010d1`.
- Validation branch: `feature/community-ministry-hub-staging-validation`.
- Production deployment: not performed.
- Production data mutation: not allowed.

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

The admin area displays a visible nonproduction banner whenever `APP_ENV` is not `production`.

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

## Authorization Checklist

- Platform admin can access all admin Community Hub routes.
- Church A representative cannot access Church B event admin, registrations, exports, or flyers.
- Church B representative cannot access Church A private data.
- Limited event manager can manage assigned church events without platform admin privileges.
- Anonymous user can browse published public events and submit event reports only through server actions.
- Direct Firestore and Storage access denies private records and writes.

## SMTP Checklist

Staging SMTP is blocked until a staging-safe SMTP provider or mail-testing service is configured.

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

## Current Staging Status

No real staging URL or dedicated staging Firebase project was provided in this phase. Local/emulator automated validation can run, but full staging certification remains blocked.

Executed locally in the Firebase Emulator Suite:

- `npm run seed:community-hub-staging -- --dry-run`: passed with 3 churches, 7 events, 18 registrations, and 72 planned Firestore writes.
- `npm run seed:community-hub-staging -- --dry-run --large`: passed with 107 events, 1,112 registrations, and 2,760 planned Firestore writes.
- Emulator seed/reset round trip: passed with 5 Auth users and 72 Firestore documents created, then 5 Auth users and 72 Firestore documents deleted.
