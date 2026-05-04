# Production Setup

## Recommended deployment target

Recommended:

- Firebase App Hosting for the Next.js application

Also compatible:

- Vercel or another Node-compatible host that supports the Next.js build and server runtime

## Required commands

- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start`

## Production environment variables

### Site

```bash
NEXT_PUBLIC_SITE_URL=https://findyourchurchpalacios.org
NEXT_PUBLIC_DONATION_URL=
NEXT_PUBLIC_ENABLE_DONATIONS=true
NEXT_PUBLIC_ZEFFY_FORM_PATH=/embed/donation-form/helping-churches-reach-people-through-technology
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

### Firebase client

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_ID=findyourchurchpal
```

### Firebase admin

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
FIREBASE_DATABASE_ID=findyourchurchpal
```

If your production host provides Google-managed credentials, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` may not be necessary as long as the runtime has proper access to the Firebase project.

### Email

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=support@findyourchurchpalacios.org
ADMIN_NOTIFICATION_EMAIL=support@findyourchurchpalacios.org

# Resend option
RESEND_API_KEY=

# SMTP option
SMTP_HOST=findyourchurchpalacios.org
SMTP_PORT=465
SMTP_USER=support@findyourchurchpalacios.org
SMTP_PASSWORD=
LISTING_VERIFICATION_CRON_SECRET=
```

### Admin seed

```bash
FIREBASE_ADMIN_SEED_EMAIL=
FIREBASE_ADMIN_SEED_PASSWORD=
FIREBASE_ADMIN_SEED_NAME=
FIREBASE_ADMIN_SEED_PHONE=
```

## Firebase production checklist

1. Enable Firebase Authentication.
2. Enable Email/Password sign-in.
3. Confirm Firestore database `findyourchurchpal`.
4. Confirm Firebase Storage bucket exists and uploads work.
5. Set production environment variables.
6. Review and deploy `firestore.rules`.
7. Review and deploy `storage.rules`.
8. Create the first admin user.
9. Run a test submission.
10. Approve a submission from the admin portal.
11. Run a claim request and representative login test.
12. Add the live domain to Firebase Authentication authorized domains if needed.

## Firestore and Storage rules deployment

Before launch, make sure the current rule files in the repo are the same ones deployed in Firebase Console:

- [firestore.rules](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/firestore.rules)
- [storage.rules](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/storage.rules)

Manual reminder:

- public users should only read published churches
- direct browser uploads should stay restricted
- internal notes and admin-only collections should not be publicly readable

## SMTP settings for `support@findyourchurchpalacios.org`

If you use the mailbox details you shared, the production SMTP settings are expected to be:

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=support@findyourchurchpalacios.org
ADMIN_NOTIFICATION_EMAIL=support@findyourchurchpalacios.org
SMTP_HOST=findyourchurchpalacios.org
SMTP_PORT=465
SMTP_USER=support@findyourchurchpalacios.org
SMTP_PASSWORD=<the mailbox password>
```

Do not commit the mailbox password. Keep it only in your deployment environment.

Safe live verification:

```bash
ALLOW_REAL_EMAIL_TEST=true npm run test:email
```

Expected result:

- the configured recipient receives the email
- an `emailLogs` record is created
- no SMTP secrets are printed

## Annual listing verification job

To help keep church listings accurate, production can run a lightweight yearly verification flow.

What it does:

- checks the last meaningful listing activity once per run
- sends a one-click acknowledgement email after one year of inactivity
- starts a 14-day grace period
- sends reminder emails with 7 days remaining and 3 days remaining
- archives the listing if no acknowledgement is received

Recommended setup:

1. Set `LISTING_VERIFICATION_CRON_SECRET` in production.
2. Schedule a daily `POST` request to `/api/jobs/listing-verifications`.
3. Pass the secret in the `x-cron-secret` header.
4. Run `npm run process:listing-verifications -- --dry-run` locally first so you know what the job will do.

GitHub Actions option:

1. This repo includes `.github/workflows/listing-verification-cron.yml`.
2. Add GitHub repository secret `LISTING_VERIFICATION_CRON_SECRET` with the same value used in App Hosting.
3. Optional: add repository variable `LISTING_VERIFICATION_SITE_URL` if you need the workflow to target a different domain than `https://findyourchurchpalacios.org`.
4. The workflow runs daily at `14:00 UTC` and can also be started manually from the GitHub Actions tab.

## Domain connection checklist

For `FindYourChurchPalacios.org`:

1. Connect the custom domain in your hosting provider.
2. Update `NEXT_PUBLIC_SITE_URL` to the real domain.
3. Confirm SSL is active.
4. Confirm homepage, directory, and church profiles load on the real domain.
5. Verify `robots.txt` and `sitemap.xml`.
6. Check canonical tags on the live domain.
7. Verify email links and donation links on the live site.
8. Confirm admin login, portal login, and confirmation pages remain `noindex`.

## No-production-fallback expectations

Production launch should confirm:

- no reliance on local file uploads
- no fallback to local demo churches when Firebase is empty
- no `.env.local` or secrets committed
- no sample churches visible unless intentionally imported

## Final production launch order

1. Copy `data/palacios-churches.example.json` to a local `data/palacios-churches.json`.
2. Preview demo cleanup if needed: `npm run cleanup:demo-data -- --dry-run`
3. Remove demo data when ready: `npm run cleanup:demo-data -- --confirm`
4. Preview the real church import: `npm run import:palacios -- --input data/palacios-churches.json --dry-run`
5. Run the live import for real: `npm run import:palacios -- --input data/palacios-churches.json --confirm`
6. Test the public site.
7. Test the admin workflow.
8. Test the representative workflow.
9. Turn on the real email provider and run `npm run test:email`.
10. Set the donation link.
11. Connect the domain.
12. Re-run the manual launch checklist.

## Manual church fixes and duplicate prevention

Preferred correction order:

1. Review and approve a public submission in `/admin/submissions`.
2. Let an approved representative update the listing in `/portal/church/edit`.
3. Use admin church and representative pages for manual oversight.
4. Edit Firestore directly only as a last resort.

Duplicate prevention reminders:

- search by church name before approving a new record
- compare address, phone, and website before publishing
- prefer updating an existing church instead of creating a second listing
- use `npm run import:palacios -- --overwrite` only when you truly intend to update matching records

## Zeffy donation configuration

The production donation experience currently uses:

- modal buttons powered by Zeffy's modal script
- embedded Zeffy forms with iframe fallback

Configuration options:

- default Zeffy form path: `src/lib/config/site.ts`
- optional modal override: `NEXT_PUBLIC_DONATION_URL`
- optional embed path override: `NEXT_PUBLIC_ZEFFY_FORM_PATH`
- optional global toggle: `NEXT_PUBLIC_ENABLE_DONATIONS=false`

Launch-day checks:

1. Confirm donation buttons open the modal.
2. Confirm the embed loads on home, about, and contact.
3. Confirm the layout remains usable on mobile.
4. Confirm the fallback iframe still works if the Zeffy embed script fails.
