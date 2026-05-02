# Find Your Church Palacios

Find Your Church Palacios is the first local launch of the broader Find Your Church platform by El Roi Digital Ministries. This Phase 2B codebase keeps the public website from Phase 1 intact while moving the primary backend to Firebase so future admin approval, church ownership claims, and representative login can be layered in cleanly.

## Phase 2 included

- Public homepage, directory, church profile pages, and church submission flow
- Firebase Authentication foundation for future admin and church representative login
- Firestore-backed repository layer for churches, submissions, users, claim requests, messages, and audit logs
- Firebase Storage upload pipeline for logos and church photos when Storage is configured
- Safe local fallback storage for uploads only in development when Firebase Storage is unavailable
- Firestore and Storage rules starter files
- Firebase seed scripts for launch data and the first admin user
- Emulator configuration for Auth, Firestore, and Storage

## Firebase services integrated

- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Admin SDK
- Firebase Emulator Suite configuration

## Firestore collections

The codebase is prepared around these collections:

- `churches`
- `churchSubmissions`
- `users`
- `churchRepresentatives`
- `churchClaimRequests`
- `messages`
- `auditLogs`
- `emailLogs`
- `locations`

The active Firestore database for this project is `findyourchurchpal`. Set both `FIREBASE_DATABASE_ID` and `NEXT_PUBLIC_FIREBASE_DATABASE_ID` to that value when using the named database.

## Environment variables

Copy `.env.example` to `.env.local` and fill in the Firebase values for your project.

Important:

- Do not commit `.env.local`.
- Do not commit Firebase service account JSON files.
- Keep only `.env.example` in Git.

### Public Firebase client variables

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_ID=
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

### Server-side Firebase Admin variables

Use either the credential triplet or a local service account file path.

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
FIREBASE_DATABASE_ID=
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=
ADMIN_NOTIFICATION_EMAIL=
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

## Firebase project setup

1. Create or open your Firebase project.
2. Enable Authentication and turn on Email/Password.
3. Enable Firestore and create or confirm the named database `findyourchurchpal`.
4. Enable Storage and confirm the actual bucket name shown in Firebase Console.
5. Create a web app and copy the public config into `.env.local`.
6. Create a service account key in Firebase Console and either:
   - point `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` to the JSON file, or
   - map the JSON fields into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`

Important: never expose the private key to the browser. Admin credentials are only used in server-side code under `src/lib/firebase/admin.ts`.

If `npm run seed:admin` fails with `auth/configuration-not-found`, Authentication has not been fully initialized in Firebase yet. Open **Authentication** in Firebase Console, complete setup, and enable the **Email/Password** provider before trying the admin seed again.

## Firebase Storage setup

The current project diagnosis shows that Firestore is working, but Firebase Storage is not fully provisioned yet. Before production uploads can succeed, confirm all of the following in Firebase Console:

1. Open **Storage** in Firebase Console.
2. If Firebase shows **Get started**, finish the Storage setup flow.
3. If Firebase prompts you to upgrade billing, complete the required Blaze upgrade for the project.
4. Wait for the default bucket to be provisioned.
5. Copy the bucket URL shown in Firebase Console, such as `gs://your-project.firebasestorage.app`.
6. Set `FIREBASE_STORAGE_BUCKET` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` to the bucket name only, without `gs://`.

Examples:

- new default bucket format: `PROJECT_ID.firebasestorage.app`
- older default bucket format: `PROJECT_ID.appspot.com`

How to find the correct bucket name:

- Firebase Console -> Storage -> Files
- copy the bucket URL shown at the top of the page
- remove the `gs://` prefix before placing it in env vars

If the bucket URL is missing entirely, the default bucket has not been provisioned yet.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and add your Firebase values.
3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Seeding Firestore

Seed the Palacios launch market and demo church records into Firestore:

```bash
npm run seed:firebase
```

Overwrite existing seeded documents if needed:

```bash
npm run seed:firebase -- --overwrite
```

The seed script loads launch data from:

- `src/lib/data/churches.ts`
- `src/lib/data/locations.ts`

Those files remain the fallback source if Firebase is not configured yet.

## Creating the first admin user

You have two safe options.

### Option 1: Firebase Console

1. Create a new Authentication user in Firebase Console.
2. Create a Firestore user document in the `users` collection.
3. Use the Firebase Auth UID as the document id.
4. Set the document fields at minimum to:

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

Set these values in `.env.local`:

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

This creates the Firebase Auth user if it does not exist and upserts the matching Firestore `users` record with role `admin`.

## Submission storage behavior

Public church submissions are now saved primarily to Firestore in the `churchSubmissions` collection with status `pending_review`.

When Firebase Storage is configured and the bucket exists:

- church logos upload to `church-submissions/{submissionId}/logo/{filename}`
- church photos upload to `church-submissions/{submissionId}/photos/{filename}`

If Firebase Storage is not available during development, the app safely falls back to local file preservation:

- pending submission uploads are written to `storage/uploads/<submission-id>/`
- the Firestore submission record is still created
- an internal note is attached so the reviewer knows local fallback was used

This keeps builds and local testing from failing when Firestore is ready before Storage is fully provisioned.

Production behavior is stricter:

- production does not silently fall back to local uploads
- if church images are submitted while Storage is misconfigured, the submission action fails clearly
- the submit form returns a user-facing image upload error instead of pretending the upload succeeded

## Local fallback behavior

Firebase is the primary backend in Phase 2, but the repository layer intentionally falls back when needed:

- published churches can still load from local seed data if Firebase is not configured
- submission uploads fall back to local file storage only in development if Firebase Storage is unavailable
- the build does not require live Firebase credentials

## Firebase Emulator support

The project includes `firebase.json` and `.firebaserc` for local emulator use.

Start the emulators:

```bash
npm run emulators
```

Then set:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

The Emulator UI runs at `http://127.0.0.1:4000`.

## Auth foundation

Phase 2 does not include the full admin portal or church representative portal yet, but the auth structure is ready for the next phase:

- client auth helpers live in `src/lib/firebase/auth-client.ts`
- server token and user resolution helpers live in `src/lib/firebase/auth-server.ts`
- role helpers live in `src/lib/firebase/auth-roles.ts`
- Firestore user profiles live in the `users` collection

Current app roles:

- `admin`
- `church_primary`
- `church_editor`
- `pending_user`

For now, role checks are driven by Firestore profile data. Custom claims can be added later once the login and session flow is finalized.

## Claim-this-church foundation

The future ownership claim workflow is now prepared with:

- `churchClaimRequests` collection support
- claim request validation in `src/lib/validation/church-claim-request.ts`
- creation service in `src/lib/services/church-claim-service.ts`
- church representative types and repository support for future ownership assignment

The UI for claiming a church is intentionally deferred to Phase 3.

## Security rules

Starter rule files are included:

- `firestore.rules`
- `storage.rules`

Current intent:

- public visitors can read published churches
- public visitors cannot read pending submissions
- only admins can read and write submissions, messages, audit logs, and email logs
- users can read and update their own Firestore profile within role restrictions
- church representative access still needs tighter path-based production rules in Phase 3
- direct client uploads remain disabled until admin and church representative upload flows are finalized
- image size and content-type constraints are prepared in `storage.rules` for the future authenticated upload paths

Before a production launch, review and harden the rules with your exact auth flow, representative access scope, and Storage bucket settings.

## Testing and verification

Helpful commands:

```bash
npm run lint
npm run build
npm run seed:firebase -- --overwrite
npm run test:firebase-submission
npm run test:firebase-storage
```

What the verification script does:

- `npm run test:firebase-submission`
  - creates a pending review submission with no images
  - creates a pending review submission with a logo
  - creates a pending review submission with photos
  - confirms pending review records are written successfully
  - uses local upload fallback only in development when Storage is not ready
- `npm run test:firebase-storage`
  - checks the configured bucket name
  - queries Firebase for the default bucket state
  - lists buckets visible to the project
  - attempts a small upload and deletes it if successful
  - prints a clear failure message if Storage is disabled, missing, or misconfigured

Public verification targets:

- homepage: `/`
- directory: `/churches`
- church profile pages: `/churches/[church-slug]`
- submit page: `/submit-your-church`

## Where data lives now

- Firestore published churches and locations:
  - seeded from `src/lib/data/churches.ts` and `src/lib/data/locations.ts`
- Firestore pending submissions:
  - `churchSubmissions` collection
- local upload fallback:
  - `storage/uploads/<submission-id>/`

## Secret handling

- `.env.local` must stay local and should never be committed.
- Firebase service account JSON files should never be copied into the repo.
- Public Firebase web config values are fine to expose to the browser, but admin credentials are not.
- If a service account private key, admin seed password, or other secret was ever committed to Git history, rotate it in Firebase or Google Cloud immediately and replace the local env values afterward.

## Ready for Phase 3

This Phase 2 foundation is ready for:

- admin approval dashboard
- deny and request-changes workflow
- email delivery wiring and `emailLogs`
- claim review workflow
- church representative invitation flow
- ownership transfer logging
- church editor permissions

## Notes

- Public directory pages only show churches with `published` status.
- New public submissions always save as `pending_review`.
- Address data remains structured and includes latitude/longitude placeholders for future geocoding and map search.
- Notification delivery is still stubbed intentionally until the Phase 3 admin workflow is built.
