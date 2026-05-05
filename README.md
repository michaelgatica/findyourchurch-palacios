# Find Your Church Palacios

Find Your Church Palacios is the first local launch of the broader Find Your Church vision by El Roi Digital Ministries. The platform helps residents, visitors, and families discover local churches, view service times, and connect with church communities in the Palacios area.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.

## Phase 7 status

Phase 7 prepares the project for the real production launch of FindYourChurchPalacios.org with:

- polished public homepage, directory, church profiles, submit flow, and claim flow
- protected admin portal and representative portal
- Firebase Authentication, Cloud Firestore, Firebase Storage, and Firebase Admin SDK
- submission review, claim review, update review, messaging, audit logs, and email logs
- legal/trust pages
- donation-supported ministry messaging
- sitemap, robots, canonical metadata, Open Graph, and optional analytics hooks
- launch-readiness docs and cleanup scripts for demo/test data
- import tooling for real Palacios church data
- production setup, outreach, and final launch QA support
- live email verification safeguards
- Zeffy donation embed and modal readiness

## Main routes

### Public

- `/`
- `/churches`
- `/churches/[churchSlug]`
- `/churches/[churchSlug]/claim`
- `/churches/[churchSlug]/claim/confirmation`
- `/submit`
- `/submit/confirmation`
- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/listing-guidelines`
- `/listing-acknowledge`

### Admin

- `/admin/login`
- `/admin`
- `/admin/submissions`
- `/admin/submissions/[submissionId]`
- `/admin/churches`
- `/admin/churches/[churchId]/representatives`
- `/admin/updates`
- `/admin/updates/[updateRequestId]`
- `/admin/claims`
- `/admin/claims/[claimRequestId]`

### Representative portal

- `/portal/login`
- `/portal`
- `/portal/church`
- `/portal/church/edit`
- `/portal/messages`
- `/portal/team`
- `/portal/transfer-ownership`
- `/portal/updates`

## Stack

- Next.js App Router
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Admin SDK
- Firebase Emulator support for local workflows

## Firestore collections

- `churches`
- `churchSubmissions`
- `users`
- `churchRepresentatives`
- `churchClaimRequests`
- `churchUpdateRequests`
- `ownershipTransferRequests`
- `messages`
- `auditLogs`
- `emailLogs`
- `locations`

The active Firestore database for this project is `findyourchurchpal`. Set both `FIREBASE_DATABASE_ID` and `NEXT_PUBLIC_FIREBASE_DATABASE_ID` when you are using the named database.

## Environment variables

Copy `.env.example` to `.env.local`.

Important:

- Never commit `.env.local`.
- Never commit Firebase service account JSON keys.
- If a real key, password, or provider secret was ever committed anywhere, rotate it immediately.

### Public variables

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_DONATION_URL=
NEXT_PUBLIC_ENABLE_DONATIONS=true
NEXT_PUBLIC_ZEFFY_FORM_PATH=/embed/donation-form/helping-churches-reach-people-through-technology

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_ID=
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false

NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

### Server-side Firebase variables

Use either a service account JSON file path locally or the project/client/private key triplet. On Firebase App Hosting or another Google-managed runtime, the app can also use default application credentials.

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
FIREBASE_DATABASE_ID=
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=
```

### Email provider variables

```bash
ADMIN_NOTIFICATION_EMAIL=
EMAIL_PROVIDER=console
EMAIL_FROM=
RESEND_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
LISTING_VERIFICATION_CRON_SECRET=
```

`ADMIN_NOTIFICATION_EMAIL` can be a single inbox or a comma-separated list, for example:

```bash
ADMIN_NOTIFICATION_EMAIL=support@findyourchurchpalacios.org,support@elroidigital.org
```

Supported providers:

- `console`
- `resend`
- `smtp`

### Optional email test variables

```bash
TEST_EMAIL_TO=
ALLOW_REAL_EMAIL_TEST=false
```

### Optional admin seed variables

```bash
FIREBASE_ADMIN_SEED_EMAIL=
FIREBASE_ADMIN_SEED_PASSWORD=
FIREBASE_ADMIN_SEED_NAME=
FIREBASE_ADMIN_SEED_PHONE=
```

### Emulator variables

```bash
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

## Firebase setup

1. Create or open the Firebase project.
2. Enable Authentication and turn on Email/Password.
3. Enable Firestore and create or confirm the named database `findyourchurchpal`.
4. Enable Storage and confirm the real bucket name shown in Firebase Console.
5. Create the web app config and place the public values in `.env.local`.
6. For local admin access, either:
   - set `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` to a local JSON key, or
   - set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`
7. For Firebase App Hosting, set the same env vars in the backend environment settings. App Hosting can use its managed credentials when available.
8. In Firebase Authentication, add your live domain to the authorized domains list before launch if needed.

## Firebase Storage setup

1. Open Firebase Console -> Storage.
2. Finish the Storage setup flow if needed.
3. Copy the bucket URL shown there, for example:
   - `gs://PROJECT_ID.firebasestorage.app`
   - `gs://PROJECT_ID.appspot.com`
4. Set both:
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_STORAGE_BUCKET`
5. Use only the bucket name in env vars, without the `gs://` prefix.

Current upload behavior:

- public submissions upload to `church-submissions/{submissionId}/...`
- representative listing media uploads to `churches/{churchId}/...`
- development can fall back to local uploads if Storage is unavailable
- production does not silently fall back to local uploads

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Admin setup

### Option 1: Firebase Console

1. Create a Firebase Authentication user.
2. Create a Firestore document in `users` using the auth UID as the document id.
3. Set at least:

```json
{
  "firebaseUid": "THE_AUTH_UID",
  "name": "Admin Name",
  "email": "admin@example.org",
  "role": "admin",
  "createdAt": "ISO_TIMESTAMP",
  "updatedAt": "ISO_TIMESTAMP"
}
```

### Option 2: Seed script

Set these in `.env.local`:

```bash
FIREBASE_ADMIN_SEED_EMAIL=admin@example.org
FIREBASE_ADMIN_SEED_PASSWORD=replace-with-a-strong-password
FIREBASE_ADMIN_SEED_NAME=Find Your Church Admin
FIREBASE_ADMIN_SEED_PHONE=
```

Then run:

```bash
npm run seed:admin
```

## Representative portal access

- representative sign-in uses Firebase email/password
- server access uses the HTTP-only session cookie
- portal access requires an active `churchRepresentatives` record
- allowed representative permission roles:
  - `primary_owner`
  - `editor`
- allowed statuses:
  - `active`
- `suspended` and `transferred` representatives cannot edit

Primary owner capabilities:

- edit listing
- invite one editor
- request ownership transfer

Editor capabilities:

- edit listing
- message admin
- view listing activity

## Public submission, claim, and update workflows

### Church submission

- public form saves to `churchSubmissions`
- initial status is `pending_review`
- uploaded logo/photos go to Firebase Storage when configured
- submitter confirmation email is sent or logged
- admin notification email is sent or logged

### Submission approval

When approved:

- submission status becomes `approved`
- church record is created or updated in `churches`
- church status becomes `published`
- media URLs are preserved
- audit and email logs are written

### Claim request

- public church profile includes `Claim This Church`
- signed-in user submits claim request
- request saves to `churchClaimRequests` with `pending_review`
- approved claim creates or updates the church representative ownership record

### Representative listing updates

`church.autoPublishUpdates` controls update behavior:

- `true`: representative edits update the public church immediately and still create update history
- `false`: representative edits create a `churchUpdateRequests` record for admin review

### Annual listing verification

Published church listings now support a lightweight annual verification cycle to help keep the directory accurate.

- the cycle looks for the latest real listing activity:
  - representative portal access
  - listing acknowledgement from email
  - listing update approval / verification
- after one year without activity, the system emails a one-click acknowledgement link
- if there is no response, a 14-day grace period begins
- reminder emails go out with 7 days remaining and 3 days remaining
- if there is still no acknowledgement, the listing is archived instead of hard-deleted

Helpful paths and commands:

- public acknowledgement page: `/listing-acknowledge?token=...`
- manual dry run: `npm run process:listing-verifications -- --dry-run`
- live run: `npm run process:listing-verifications -- --confirm`
- scheduled job route: `POST /api/jobs/listing-verifications`

Recommended production setup:

- set `LISTING_VERIFICATION_CRON_SECRET`
- have your scheduler call the job route daily with `x-cron-secret: <secret>`
- this repo now includes a GitHub Actions workflow at `.github/workflows/listing-verification-cron.yml`
- add the same `LISTING_VERIFICATION_CRON_SECRET` value to GitHub repository secrets
- optional: add repository variable `LISTING_VERIFICATION_SITE_URL` if you ever want the workflow to target a different domain
- run a dry run first before letting the live job archive anything

### Editor invite

- only the primary owner can invite one editor
- invited editor signs in with the same email address
- the invite activates after sign-in

### Ownership transfer

- only the primary owner can request it
- admin reviews the request
- approval changes the primary representative
- denial leaves current ownership unchanged

## Email behavior

Email delivery flows through `src/lib/services/email-service.ts`.

Every attempted email also writes an `emailLogs` record.

Recommended production setup:

- set `EMAIL_PROVIDER=resend` or `EMAIL_PROVIDER=smtp`
- set `EMAIL_FROM`
- set `ADMIN_NOTIFICATION_EMAIL`
- if you want multiple admin inboxes copied on workflow alerts, use a comma-separated `ADMIN_NOTIFICATION_EMAIL`
- verify the sender domain with your provider

Development-safe behavior:

- `EMAIL_PROVIDER=console` logs messages locally and still writes `emailLogs`

Production-ready SMTP example using your church domain mailbox:

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=support@findyourchurchpalacios.org
ADMIN_NOTIFICATION_EMAIL=support@findyourchurchpalacios.org
SMTP_HOST=findyourchurchpalacios.org
SMTP_PORT=465
SMTP_USER=support@findyourchurchpalacios.org
SMTP_PASSWORD=<mailbox-password>
```

Safe email verification:

```bash
npm run test:email
```

Live email verification:

```bash
ALLOW_REAL_EMAIL_TEST=true npm run test:email
```

Notes:

- `EMAIL_PROVIDER=console` is the safest local default
- `npm run test:email` will not use a live provider unless `ALLOW_REAL_EMAIL_TEST=true`
- set `TEST_EMAIL_TO` if you want to direct a non-console test to a specific inbox
- in production, `ADMIN_NOTIFICATION_EMAIL` should be set so admin workflow messages have a real destination
- a successful live email test should send the message, create an `emailLogs` record, and avoid printing secrets

## Zeffy donation setup

The site now uses Zeffy in two ways:

- modal-enabled donation buttons
- embedded donation form panels with iframe fallback

Current configuration points:

- default embedded form path: `src/lib/config/site.ts`
- optional modal/button override: `NEXT_PUBLIC_DONATION_URL`
- optional Zeffy embed path override: `NEXT_PUBLIC_ZEFFY_FORM_PATH`
- optional donation UI toggle: `NEXT_PUBLIC_ENABLE_DONATIONS=false`

Testing notes:

- verify the donation buttons open the Zeffy modal when the script loads
- verify the embedded form appears on the home, about, and contact pages
- if the Zeffy embed script fails, confirm the iframe fallback still renders
- donation wording should remain clearly optional and never gate listings

## Real content readiness

### Seed locations and sample churches

Development-friendly seed with sample churches:

```bash
npm run seed:firebase
```

Explicitly include samples in production or staging only if you truly intend to:

```bash
npm run seed:firebase -- --include-samples
```

Production-safe behavior:

- location records are always safe to seed
- sample churches are skipped by default in production unless `--include-samples` is used
- public pages no longer fall back to local sample churches in production when Firebase is configured

### Import real Palacios churches

The repo includes a JSON import path for real launch data:

- example template: `data/palacios-churches.example.json`
- local import file: `data/palacios-churches.json`

`data/palacios-churches.json` is intentionally gitignored so real working data does not get committed by accident.

Suggested workflow:

1. Copy `data/palacios-churches.example.json` to `data/palacios-churches.json`.
2. Fill in the real Palacios churches.
3. Dry-run the import:

```bash
npm run import:palacios -- --input data/palacios-churches.json --dry-run
```

4. Run the live import when the preview looks correct:

```bash
npm run import:palacios -- --input data/palacios-churches.json --confirm
```

Useful flags:

- `--overwrite` updates existing matching churches instead of skipping them
- `--confirm` is required for any real write
- duplicate protection checks both slug and a name/address/city/state key
- imported churches default to `status: published` unless a different status is provided in the JSON
- imported records can also be marked `pending_review`
- `lastVerifiedAt` is preserved if provided
- imported records are stored with `isSeedContent: false`

### Remove demo churches

```bash
npm run cleanup:demo-data -- --dry-run
npm run cleanup:demo-data -- --confirm
```

This removes churches where `isSeedContent === true`.

Safety notes:

- the cleanup command now requires `--dry-run` or `--confirm`
- always preview first before removing anything from a shared Firebase project

### Remove workflow test artifacts

```bash
npm run cleanup:test-data -- --dry-run
npm run cleanup:test-data -- --confirm
```

This is intended for cleanup after running Phase 3 and Phase 4 workflow verification against a live Firebase project. It removes the main workflow verification records from Firestore. Review the script before using it in any shared environment.

It also cleans up the Firebase submission verification records created by `npm run test:firebase-submission`.

### Adding a real church manually

Preferred options:

1. Have the church submit through the public `/submit` form and approve it in `/admin/submissions`.
2. If you must add it directly, create the Firestore record in `churches` with:
   - a unique `slug`
   - `status: published`
   - structured address fields
   - service times
   - contact information
   - `updatedAt`
   - `publishedAt`

### Replacing demo listings with real listings

1. Preview demo cleanup with `npm run cleanup:demo-data -- --dry-run`.
2. Remove demo data with `npm run cleanup:demo-data -- --confirm`.
3. Import real churches or approve real submissions from `/admin/submissions`.
4. Confirm only real published churches appear on `/churches`.

### Duplicate prevention tips

- search the admin churches page before approving a new submission
- compare church name, address, phone, and website
- prefer updating an existing church record if the listing already exists
- use claim access for authorized representatives instead of creating second listings

### Manual church listing corrections

For a real launch, prefer these correction paths in order:

1. Admin review an incoming submission in `/admin/submissions`
2. Approved representative edits through `/portal/church/edit`
3. Admin church management views for representative and update oversight
4. Direct Firestore editing only as a last resort, with an audit note

## Legal and trust pages

Phase 5 adds:

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/listing-guidelines`

These pages should be reviewed before public launch so ministry wording, contact details, and legal expectations reflect your final ministry decisions.

## SEO and launch polish

Implemented in Phase 5:

- canonical URLs from `NEXT_PUBLIC_SITE_URL`
- Open Graph and Twitter metadata
- metadata titles and descriptions for public pages
- church profile titles based on church name
- `robots.txt`
- `sitemap.xml`
- optional Google site verification
- optional Google Analytics injection when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set

Phase 7 launch notes:

- set `NEXT_PUBLIC_SITE_URL=https://findyourchurchpalacios.org` in production
- admin login, portal login, and confirmation pages are configured with `noIndex`
- `robots.txt` and `sitemap.xml` both derive their production URLs from `NEXT_PUBLIC_SITE_URL`

## Security notes

Current hardening intent:

- admin routes require authenticated users with Firestore `role: admin`
- representative routes require an active church representative record
- public users cannot read pending submissions, internal notes, or admin-only logs
- representatives cannot directly edit unrelated churches
- only primary owners can invite editors or request ownership transfer
- direct browser uploads remain disabled in Storage rules for now
- trusted server actions and Firebase Admin SDK perform sensitive writes

Before production launch:

- review `firestore.rules`
- review `storage.rules`
- confirm provider secrets are only server-side
- confirm `.env.local` is ignored by Git
- confirm `data/palacios-churches.json` is ignored by Git
- confirm test/demo data is removed

## Deployment readiness

Recommended deployment path for this project:

- Firebase App Hosting for the Next.js app

Also workable:

- Vercel, if all Firebase server env vars are configured correctly

Production deployment notes:

- set `NEXT_PUBLIC_SITE_URL` to the real domain
- set the Firebase public client env vars
- set server Firebase env vars or rely on managed credentials where supported
- configure the Zeffy donation settings you want to use
- set `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider credentials
- connect the custom domain for `FindYourChurchPalacios.org`
- confirm production email with `npm run test:email`

Future migration note:

- the data model and path helpers are prepared so this can later expand toward `FindYourChurch.org` and broader city/state routing

## Domain launch notes

For `FindYourChurchPalacios.org`:

1. connect the custom domain in your hosting provider
2. update `NEXT_PUBLIC_SITE_URL`
3. verify sitemap and robots
4. re-check canonical tags on the live domain
5. add the live domain to Firebase Authentication authorized domains if needed

## Optional analytics and monitoring placeholders

Currently optional:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`

Future TODOs can include:

- Google Search Console
- Firebase Analytics
- error monitoring

## Testing

Helpful commands:

```bash
npm run lint
npm run build
npm run seed:firebase -- --overwrite
npm run seed:admin
npm run test:firebase-submission
npm run test:firebase-storage
npm run test:email
npm run process:listing-verifications -- --dry-run
npm run test:phase3-workflows
npm run test:phase4-workflows
npm run import:palacios -- --input data/palacios-churches.example.json --dry-run
npm run cleanup:test-data -- --dry-run
npm run cleanup:demo-data -- --dry-run
```

Notes:

- `test:phase3-workflows` and `test:phase4-workflows` expect `FIREBASE_ADMIN_SEED_EMAIL` or `ADMIN_NOTIFICATION_EMAIL`
- if no matching Firebase Auth admin exists yet, the workflow scripts can create a backend-only admin profile for verification
- a real admin login test still requires a real Firebase Authentication admin user
- if those tests are run against a shared live Firebase project, use the cleanup scripts afterward

## Launch checklist

See [docs/launch-checklist.md](docs/launch-checklist.md).

Additional launch docs:

- [docs/production-setup.md](docs/production-setup.md)
- [docs/church-outreach-summary.md](docs/church-outreach-summary.md)
- [docs/automatic-email-reference.md](docs/automatic-email-reference.md)
- [docs/claude-deployment-handoff.md](docs/claude-deployment-handoff.md)

Production checklist highlights:

- Firebase project configured
- Firestore rules reviewed
- Storage rules reviewed
- admin user created
- email provider configured
- donation URL configured
- `NEXT_PUBLIC_SITE_URL` set
- test submission completed
- test approval completed
- test claim completed
- test representative login completed
- demo data removed or clearly labeled
- privacy and terms reviewed
- domain connected
- mobile tested
- sitemap verified

## Phase 7 handoff

The remaining launch steps are operational rather than architectural:

- enter and verify the real Palacios church data
- connect the live production domain
- turn on and verify the real email provider
- confirm the live Zeffy donation modal and embed behavior
- finish final manual UI testing on live infrastructure
- begin outreach to Palacios churches
