# Community Ministry Hub Implementation

Find Your Church Palacios remains a free church directory first. The Community Ministry Hub adds church-owned public events and event registration management while keeping existing submissions, claims, representative access, audit logs, email logs, and listing workflows intact.

This document is the implementation/runbook for the current Community Ministry Hub work. It covers the public events foundation, church administrator event management, and internal registration management.

Launch-readiness, platform administration, production verification, rollback, monitoring, and the current go/no-go recommendation are tracked in `docs/community-ministry-hub-launch-readiness.md`.

## Branches and Scope

- Public events foundation was already pushed to `main`.
- Church administrator event management was completed on `feature/community-ministry-hub-admin-events`.
- Registration management is being built on `feature/community-ministry-hub-registration`.
- This work must not deploy to production or mutate live production data during development.

## Architecture

- Frontend: Next.js App Router, React server components, server actions, and global CSS.
- Authentication: Firebase Authentication plus application session cookies.
- Trusted backend: Firebase Admin SDK repositories and services under `src/lib/repositories/*` and `src/lib/services/*`.
- Public reads: public church and event pages read sanitized public records.
- Representative operations: portal actions authenticate the session user, verify church access server-side, then use Admin SDK.
- Browser writes: direct browser writes to events, registrations, reports, exports, and flyer/export Storage paths are blocked by rules.
- Email: `src/lib/services/email-service.ts` supports console, Resend, and SMTP; registration notifications use the shared email logging path.

## Event Data Model

### `events`

Private operational event records. Used by portal services and trusted server actions.

Important fields include:

- `id`
- `churchId`
- `churchName`
- `churchSlug`
- `churchRoutePath`
- `createdByUserId`
- `lastEditedByUserId`
- `status`
- `visibility`
- `title`
- `slug`
- `summary`
- `description`
- `primaryType`
- `audienceTags`
- `customTags`
- `startsAt`
- `endsAt`
- `timeZone`
- `locationMode`
- `address`
- `onlineUrl`
- `costStatus`
- `registration`
- `flyerImage`
- `createdAt`
- `updatedAt`
- `publishedAt`
- `cancelledAt`
- `archivedAt`

### `publicEvents`

Sanitized projection for public event pages and lists. It excludes private registration records, internal notes, exports, and protected operational fields.

### `eventRegistrationConfigurations`

Per-event registration settings, including:

- mode
- active form version
- public availability
- opening and closing dates
- capacity
- waitlist behavior
- scheduled report settings
- public contact/display settings

### `eventRegistrationFormVersions`

Versioned form schemas. Existing registrations keep their original form version so later form changes do not rewrite historical submissions.

### `eventRegistrations`

Private registration records scoped by `eventId` and `churchId`.

Stored fields include:

- confirmation number
- public status
- attendee count
- contact name/email/phone when collected
- answer payloads
- selected export/search fields
- form version
- submission metadata
- cancellation/deletion markers

### Supporting Registration Collections

- `eventRegistrationCounters`
- `eventRegistrationAccessTokens`
- `eventRegistrationIdempotency`
- `eventRegistrationRateLimits`
- `eventRegistrationExports`
- `eventRegistrationJobs`
- `eventRegistrationAuditLogs`

## Storage Paths

- Public event flyers: `churches/{churchId}/events/{eventId}/flyer/{safeFileName}`
- Private registration exports: `private/event-exports/{churchId}/{eventId}/{exportId}/{fileName}`

Flyer upload is handled by trusted server services. Export files are private and downloaded through a trusted route after representative authorization.

## Public Routes

- `/events`
- `/events/[eventSlug]`
- `/events/[eventSlug]/register`
- `/events/[eventSlug]/register/confirmation`
- `/registrations/manage/[accessToken]`

Published public events appear on `/events`, event detail pages, church profiles, and the homepage upcoming-events section when appropriate. Draft, pending, archived, and private registration data are not publicly listed.

## Portal Routes

- `/portal/events`
- `/portal/events/new`
- `/portal/events/[eventId]/edit`
- `/portal/events/[eventId]/registration`
- `/portal/events/[eventId]/registration/form`
- `/portal/events/[eventId]/registration/new`
- `/portal/events/[eventId]/registration/[registrationId]`
- `/portal/events/[eventId]/check-in`
- `/portal/events/[eventId]/exports`

Representatives only see and manage events for churches they are authorized to manage.

## Event Status Rules

Supported statuses:

- `draft`
- `pending_review`
- `published`
- `unlisted`
- `cancelled`
- `completed`
- `archived`

Allowed transitions:

- `draft` -> `published`
- `draft` -> `unlisted`
- `draft` -> `pending_review` if review is required
- `pending_review` -> `published`
- `published` -> `unlisted`
- `unlisted` -> `published`
- `published` -> `cancelled`
- `unlisted` -> `cancelled`
- `published` -> `archived`
- `cancelled` -> `archived`
- `completed` -> `archived`
- `archived` -> restored by authorized action

Published events are not permanently deleted through the regular interface. Drafts may be deleted. Completed display behavior can be derived from `endsAt`; this implementation does not silently rewrite event status just because an event date passed.

## Registration Modes

Implemented in the event editor:

- no registration
- simple RSVP
- internal custom registration
- Google Forms registration
- other external registration

External URLs must use HTTPS. Google Forms mode accepts Google Forms URLs and `forms.gle` links. Internal custom registration uses the form builder and public registration pages.

## Form Builder

The form builder supports:

- six presets
- custom sections
- supported field types
- required fields
- helper text
- placeholders
- export inclusion flags
- sensitive field classification
- conditional display
- repeating participant groups
- validation limits
- schema fingerprints
- form version history

Rejected field/data behavior includes:

- prohibited fields such as payment card or SSN-style collection
- unsafe external URLs
- oversized text payloads
- invalid conditional references
- cyclic conditional dependencies

## Registration Workflow

1. Public visitor opens `/events/[eventSlug]/register`.
2. Server verifies event status, visibility, registration mode, open/closed window, and capacity.
3. Honeypot/challenge, idempotency, and rate-limit checks run server-side.
4. A Firestore transaction reserves confirmed or waitlisted capacity atomically.
5. The registration receives a nonsequential confirmation number.
6. A hashed management token is stored.
7. Confirmation email is sent when an email was collected.
8. Audit and email logs are written.

## Capacity and Waitlist

- Capacity checks run in Firestore transactions.
- Simultaneous final-seat submissions are guarded by counters and idempotency.
- Waitlist can be enabled with an optional waitlist capacity.
- Automatic waitlist promotion is supported when a confirmed registration is cancelled and capacity opens.
- Status changes that would exceed capacity are rejected.

## Representative Management

Representatives can:

- search registrations
- filter status
- paginate lists
- choose visible dashboard columns
- view registration details and answer snapshots
- create manual registrations
- check in attendees
- mark attended
- cancel registrations
- delete personal registration data after cancellation
- view registration audit history
- export PDF/XLSX reports
- email reports to authorized recipients

The UI labels registration counts as real counts. It does not fabricate registration numbers.

## Reports and Exports

Supported formats:

- PDF
- XLSX

Implemented report types:

- roster
- check-in list
- full responses
- answer summary
- daily digest
- final report

Export protections:

- representative authorization before generation and download
- optional sensitive-field confirmation
- spreadsheet formula neutralization
- private Storage path
- 24-hour expiry metadata
- email recipient validation

## Scheduled Jobs

The registration job processor handles:

- reminder emails
- daily digest emails
- final report emails
- expired access token cleanup
- expired export cleanup

Endpoint:

- `POST /api/jobs/registration`

Required header:

- `x-cron-secret: <REGISTRATION_JOBS_CRON_SECRET>`

Local command:

```powershell
npm run process:registration-jobs -- --dry-run
npm run process:registration-jobs -- --confirm
```

Recommended production schedule: every 5 to 15 minutes. Production schedule execution must be configured by the host or GitHub Actions and should call the endpoint with `REGISTRATION_JOBS_CRON_SECRET`.

## Email Notifications

Implemented registration emails include:

- registration received
- waitlist confirmation
- registration cancelled
- waitlist promoted
- reminder
- daily digest
- final report
- manual/admin registration notice where applicable

Emails use the shared email service and should be logged in `emailLogs` when sent through the production email path.

## Security Rules

Firestore:

- Public users can read only public-safe event projections.
- Normal public listings include only published public events.
- Unlisted and cancelled previously published event pages can be resolved without exposing administrative records.
- Draft, pending, archived, registration, token, export, job, counter, and audit records are private.
- Direct browser writes to event and registration collections are denied.
- Admin users may read protected operational records.
- Server-maintained fields cannot be forged by browser writes because those writes are denied.

Storage:

- Public flyer objects can be read.
- Flyer directories cannot be listed.
- Private registration exports cannot be read directly by public users or representatives.
- Direct browser flyer/export writes and deletes are denied.
- Trusted server operations enforce church ownership, file validation, safe paths, and replacement/deletion behavior.

## Authorization Pattern

Every trusted event or registration operation must:

1. Authenticate the user.
2. Verify platform admin or active representative access.
3. Verify event `churchId` belongs to the authorized church.
4. Reject cross-church operations.
5. Validate protected fields server-side.
6. Write an audit entry.

The current representative model uses random `churchRepresentatives` document IDs, so complex representative checks happen in trusted server services rather than direct browser Firestore rules.

## Required Indexes

Checked into `firestore.indexes.json`:

- `events`: `status`, `visibility`, `startsAt`
- `events`: `churchId`, `status`, `visibility`, `startsAt`
- `events`: `churchId`, `startsAt DESC`
- `publicEvents`: `status`, `visibility`, `startsAt`
- `publicEvents`: `churchId`, `status`, `visibility`, `startsAt`
- `eventRegistrations`: `eventId`, `status`, `submittedAt DESC`
- `eventRegistrations`: `eventId`, `contactNameNormalized`
- `eventRegistrations`: `eventId`, `confirmationNumber`
- `eventRegistrations`: `eventId`, `searchPrefixes`, `submittedAt DESC`
- `eventRegistrationJobs`: `status`, `runAt`

Deploy indexes before enabling this feature in production.

## Required Environment Variables

Existing site/Firebase/email variables still apply. Registration-specific variables:

- `REGISTRATION_TOKEN_SECRET`
- `REGISTRATION_JOBS_CRON_SECRET`

Local emulator helpers:

- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8180`
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
- `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`

`REGISTRATION_TOKEN_SECRET` must be strong and private in production. Do not expose it through `NEXT_PUBLIC_*`.

## Local Emulator Instructions

The Firestore emulator uses port `8180` in this repo because `8080` may be occupied by local development services.

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
npm run test:event-security
npm run test:registration-emulator
```

These commands use `demo-find-your-church` and should not touch production.

## Testing Commands

```powershell
npm run test:event-validation
npm run test:directory-routing
npm run test:registration-validation
npm run test:registration-reports
npm run test:registration-scheduler
npm run test:event-security
npm run test:registration-emulator
npm run lint
npm run build
```

Also run `npx tsc --noEmit` when changing shared types or server services.

## Known Limitations

- Recurring-event editing is still not implemented; the model boundary exists.
- A separate limited event manager role is not exposed in the current representative UI.
- Firebase App Check is not enabled in this implementation; public registration abuse controls are honeypot, challenge, idempotency, and rate limiting.
- Production cron execution and live email delivery must be verified in the deployed environment.
- Large exports are generated server-side in memory; future work should add asynchronous/chunked exports for very large events.
- Policy language should receive human/legal review before launch.

## Next Phase

Recommended next phase:

- complete staging manual browser QA
- verify live SMTP registration emails
- configure and observe production-like scheduler
- decide whether to enforce Firebase App Check
- add async export processing for very large events
