# Claude Deployment Handoff

This document is the quick-start handoff for Claude when helping on **Find Your Church Palacios**.

Important collaboration note:

- **Codex is the main builder for this project**
- **Claude is a secondary reviewer / second set of eyes**
- Claude should prefer reviewing, validating, documenting, and sanity-checking changes unless explicitly asked to take the lead on a specific task

This project is live, so Claude should be careful about:

- production environment variables
- Firebase rules
- App Hosting rollouts
- email configuration
- data cleanup scripts

## Project location

```text
C:\Users\micha\Desktop\El Roi Digital Ministries Codex Files\Find My Church Palacios
```

## What this project is

Find Your Church Palacios is a live Next.js + Firebase church directory and ministry platform with:

- public church directory
- church profile pages
- public submit flow
- public claim flow
- admin portal
- representative portal
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- SMTP email delivery
- annual listing verification automation

## Claude's role

Claude should usually help by:

- reviewing proposed code changes
- confirming environment or deployment settings
- checking that documentation matches the real setup
- validating rollout steps
- helping write copy or support docs
- doing a second-pass QA review

Claude should avoid making assumptions about production values that are not visible in the repo.

## Main deployment flow

When Codex or Claude makes a change, the normal flow is:

```powershell
git status
npm.cmd run lint
npm.cmd run build
git add .
git commit -m "Describe the change"
git push origin main
```

After that:

1. Firebase App Hosting should detect the new `main` commit
2. A rollout should begin automatically
3. If not, manually redeploy from Firebase App Hosting → Rollouts

## Firebase App Hosting target

- Backend name: `findyourchurch-palacios`
- Production domain: `https://findyourchurchpalacios.org`

Claude should check:

- App Hosting rollout status
- production env vars
- whether the latest `main` commit is the one being deployed

## Required production environment variables

These are set in:

- Firebase Console
- App Hosting
- `findyourchurch-palacios`
- Settings → Environment

### Site

```env
NEXT_PUBLIC_SITE_URL=https://findyourchurchpalacios.org
NEXT_PUBLIC_DONATION_URL=
NEXT_PUBLIC_ENABLE_DONATIONS=true
NEXT_PUBLIC_ZEFFY_FORM_PATH=/embed/donation-form/helping-churches-reach-people-through-technology
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

### Firebase client

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_ID=findyourchurchpal
```

### Firebase admin

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
FIREBASE_DATABASE_ID=findyourchurchpal
```

Notes:

- In some Firebase/App Hosting setups, managed credentials may cover admin access
- If admin/server functions break, check these first

### Email

```env
ADMIN_NOTIFICATION_EMAIL=support@findyourchurchpalacios.org,support@elroidigital.org
EMAIL_PROVIDER=smtp
EMAIL_FROM=support@findyourchurchpalacios.org
SMTP_HOST=premium43-1.web-hosting.com
SMTP_PORT=465
SMTP_USER=support@findyourchurchpalacios.org
SMTP_PASSWORD=
LISTING_VERIFICATION_CRON_SECRET=
```

### Admin seed

```env
FIREBASE_ADMIN_SEED_EMAIL=
FIREBASE_ADMIN_SEED_PASSWORD=
FIREBASE_ADMIN_SEED_NAME=
FIREBASE_ADMIN_SEED_PHONE=
```

## Known Firebase project values

These are established project values already used in the app:

```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=findyourchurch-24562.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=findyourchurch-24562
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=443706380375
NEXT_PUBLIC_FIREBASE_APP_ID=1:443706380375:web:e2f1c184b87865e003d312
NEXT_PUBLIC_FIREBASE_DATABASE_ID=findyourchurchpal
FIREBASE_PROJECT_ID=findyourchurch-24562
FIREBASE_DATABASE_ID=findyourchurchpal
```

Claude should not guess missing secrets. If a value is not in the repo, it should be checked in Firebase Console or App Hosting env settings.

## Firebase production checklist

Claude should confirm these when reviewing launch readiness:

1. Firebase Authentication enabled
2. Email/Password sign-in enabled
3. Firestore database exists and is `findyourchurchpal`
4. Storage bucket exists and matches env vars
5. `findyourchurchpalacios.org` is an authorized domain in Firebase Auth
6. App Hosting environment variables are set
7. `firestore.rules` are deployed
8. `storage.rules` are deployed
9. first admin user exists
10. admin Firestore profile has `role: admin`

## Firestore and Storage rules

These files matter:

- [firestore.rules](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/firestore.rules)
- [storage.rules](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/storage.rules)

Important:

- App Hosting rollout does **not** automatically deploy Firebase rules
- if rules changed in code, someone must deploy them to Firebase separately

Claude should always mention that if reviewing a security-related change.

## Annual listing verification automation

This project includes a scheduled verification job.

GitHub Actions workflow:

- [.github/workflows/listing-verification-cron.yml](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/.github/workflows/listing-verification-cron.yml)

The same secret must exist in both places:

- Firebase App Hosting env:
  - `LISTING_VERIFICATION_CRON_SECRET`
- GitHub repo secrets:
  - `LISTING_VERIFICATION_CRON_SECRET`

Optional GitHub repo variable:

```env
LISTING_VERIFICATION_SITE_URL=https://findyourchurchpalacios.org
```

If the GitHub workflow shows `401 Unauthorized`, the secret values do not match.

## Email delivery notes

Production SMTP that is known to work for the mailbox:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=support@findyourchurchpalacios.org
ADMIN_NOTIFICATION_EMAIL=support@findyourchurchpalacios.org,support@elroidigital.org
SMTP_HOST=premium43-1.web-hosting.com
SMTP_PORT=465
SMTP_USER=support@findyourchurchpalacios.org
SMTP_PASSWORD=MAILBOX_PASSWORD
```

Important:

- do not switch SMTP host casually
- previous hostnames caused TLS or timeout failures

## Local development flow

Create `.env.local` from:

- [.env.example](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/.env.example)

Then run:

```powershell
npm install
npm.cmd run dev
```

## Useful commands

### Basic checks

```powershell
npm.cmd run lint
npm.cmd run build
```

### Firebase and workflow tests

```powershell
npm.cmd run test:firebase-submission
npm.cmd run test:firebase-storage
npm.cmd run test:phase3-workflows
npm.cmd run test:phase4-workflows
npm.cmd run test:email
npm.cmd run process:listing-verifications -- --dry-run
```

### Data import / cleanup

```powershell
npm.cmd run import:palacios -- --input data/palacios-churches.json --dry-run
npm.cmd run import:palacios -- --input data/palacios-churches.json --confirm
npm.cmd run cleanup:demo-data -- --dry-run
npm.cmd run cleanup:demo-data -- --confirm
npm.cmd run cleanup:test-data -- --dry-run
npm.cmd run cleanup:test-data -- --confirm
```

## Real church data notes

The project uses:

- `data/palacios-churches.example.json`
- local ignored file: `data/palacios-churches.json`

Claude should know:

- real import data should not be committed
- cleanup scripts require care
- preview with `--dry-run` before any destructive operation

## Current documentation Claude should read first

These are the most useful docs:

- [README.md](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/README.md)
- [docs/production-setup.md](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/docs/production-setup.md)
- [docs/launch-checklist.md](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/docs/launch-checklist.md)
- [docs/automatic-email-reference.md](/C:/Users/micha/Desktop/El Roi Digital Ministries Codex Files/Find My Church Palacios/docs/automatic-email-reference.md)

## Short instruction block for Claude

Use this if you want to hand Claude a quick summary:

```text
You are assisting on Find Your Church Palacios.

Codex is the main builder. You are the secondary reviewer / second set of eyes unless explicitly asked to take the lead on a specific task.

Repo:
C:\Users\micha\Desktop\El Roi Digital Ministries Codex Files\Find My Church Palacios

Before pushing:
1. Run npm.cmd run lint
2. Run npm.cmd run build
3. Run other test scripts only if the change affects those workflows

Normal deployment flow:
1. git add .
2. git commit -m "message"
3. git push origin main
4. Check Firebase App Hosting rollout for the latest main commit
5. If security rules changed, remind the user that firestore.rules and storage.rules must be deployed separately

Production host:
- Firebase App Hosting backend: findyourchurch-palacios
- Production domain: https://findyourchurchpalacios.org

Critical env groups:
- NEXT_PUBLIC_* site and Firebase client values
- FIREBASE_* admin values
- EMAIL_PROVIDER / SMTP_* / EMAIL_FROM / ADMIN_NOTIFICATION_EMAIL
- LISTING_VERIFICATION_CRON_SECRET

Key docs:
- README.md
- docs/production-setup.md
- docs/launch-checklist.md
- docs/automatic-email-reference.md
- docs/claude-deployment-handoff.md
```

## Final note

If Claude is unsure about:

- a production secret
- a live Firebase value
- whether a rule has been deployed
- whether App Hosting has finished rolling out

it should stop assuming and ask for verification instead of guessing.
