# Community Ministry Hub Implementation

Find Your Church Palacios remains a free local church directory. The Community Ministry Hub extends the existing Firebase-backed platform with public church/ministry events, event administration, registration, reports, and policy updates without replacing existing church listings, accounts, claims, submissions, representative access, audit logs, or email logs.

## Current Architecture Audit

- Frontend: Next.js App Router with React components, server components, server actions, and global CSS in `src/app/globals.css`.
- Authentication: Firebase Authentication with application session cookies handled through `src/lib/firebase/session.ts` and `src/app/api/auth/*`.
- Backend: Cloud Firestore through Firebase Admin SDK server-side repositories. Direct browser writes are mostly disabled.
- Storage: Firebase Storage through trusted server-side upload helpers; current browser uploads are blocked in `storage.rules`.
- Data access: repository layer under `src/lib/repositories/*`, with Firebase-first access and local fallback only outside production.
- Email: `src/lib/services/email-service.ts` and `notification-service.ts`, with logs in `emailLogs`.
- Authorization: admin role in `users.role`; church representatives in `churchRepresentatives` with `churchId`, `userId`, `status`, and `permissionRole`.
- Church representative enforcement: `requireRepresentativeChurchAccess()` validates the signed-in user against a church-specific representative record.
- Current public church count: homepage and directory both call `getPublishedChurches()`. If counts differ, the likely causes are client-side directory filters/location search, map-coordinate enrichment, stale production cache, or Firebase Admin availability differences rather than separate count queries.
- Legacy church routes: `/churches/[churchSlug]` redirects to canonical `/{state}/{city}/{churchSlug}`. Custom share links use `/[routeKey]` and redirect to canonical church routes. Sitemap uses canonical church paths.
- Security rules: public users can read only published churches and active locations. Admin-only and representative-sensitive workflows remain server-side.

## Event Architecture

### New public collections

- `events`: stores event public/admin metadata. Public reads are allowed only for `status == "published"` or `status == "unlisted"`.
- `eventCategories`: future admin-managed taxonomy records. Public reads may be allowed for active categories.

### Future private collections

- `eventRegistrations`: private registration records, scoped by `eventId` and `churchId`.
- `eventExports`: private export metadata and expiring download references.
- `eventReportJobs`: scheduled report/digest jobs.

Registration records must not be embedded in public event documents.

## Phase Plan

## Foundation Implemented In This Pass

- Public `/events` route with searchable/filterable upcoming event list.
- Public `/events/[eventSlug]` detail route with event metadata, host church link, registration status, external-registration handling, share links, and Google Calendar support.
- Homepage upcoming-events section with flyer/fallback event cards.
- Church profile upcoming-events section.
- Representative dashboard Events entry point and placeholder Events page.
- Event Firestore/Storage collection names and launch-safe security rules.
- Event taxonomy and shared event formatting/filtering utilities.
- `npm run test:directory-routing` regression check for published-count parity, canonical church routes, legacy route fallback, and reserved share slugs.

This pass does not yet include native event creation, registration form building, report exports, scheduled report emails, recurring-event editing, or admin category management.

## Church Administrator Event Management Implemented

- Portal dashboard route: `/portal/events`.
- Create route: `/portal/events/new`.
- Edit route: `/portal/events/[eventId]/edit`.
- Verified church representatives can create, edit, publish, unpublish to unlisted, cancel, archive, restore, duplicate, and delete draft events for their assigned church.
- Event writes are handled by trusted server actions in `src/lib/actions/portal-events.ts` and `src/lib/services/event-management-service.ts`.
- Every event mutation authenticates the session user, verifies church representative access server-side, verifies the event belongs to that church, and writes an audit log.
- Event slugs are generated once and remain stable after title edits. Duplicated events receive a new unique draft slug.
- Flyer uploads are implemented through Firebase Admin Storage under `churches/{churchId}/events/{eventId}/flyer/{fileName}`.
- Flyer validation requires JPG, PNG, or WebP; maximum 8 MB; dimensions between 400x300 and 6000x6000 pixels; safe server-generated filenames.
- Replacing or removing a flyer deletes the old Firebase Storage object after authorization.
- External registration URLs require HTTPS. Google Forms mode requires a Google Forms or `forms.gle` URL.
- Simple RSVP and internal custom registration modes are stored now, but the public registration submission flow remains a next-phase item.

## Event Status Transitions

- `draft` -> `published`.
- `draft` -> `unlisted` when publishing with unlisted visibility.
- `pending_review` -> `published`.
- `unlisted` -> `published`.
- `published` -> `unlisted`.
- `published` -> `cancelled`.
- `unlisted` -> `cancelled`.
- `published` -> `archived`.
- `cancelled` -> `archived`.
- `completed` -> `archived`.
- `archived` -> `draft` as a restore action.

Published events are not deleted through the ordinary portal interface. Draft events may be deleted. Completed status is currently display/process-ready; automatic completion is not run yet.

## Firestore Collections

- `events`: public-safe event records plus administrative ownership metadata needed by trusted server operations.
- `eventCategories`: future admin-managed taxonomy.
- `eventRegistrations`: reserved private collection for the next registration phase.
- `eventExports`: reserved private collection for future exports.

Important `events` fields include `churchId`, `churchName`, `churchSlug`, `churchRoutePath`, `createdByUserId`, `lastEditedByUserId`, `status`, `visibility`, `title`, `slug`, `summary`, `description`, `primaryType`, `audienceTags`, `customTags`, `startsAt`, `endsAt`, `timeZone`, `locationMode`, `address`, `onlineUrl`, `costStatus`, `registration`, `flyerImage`, and timestamp fields.

## Security Rules

Firestore:

- Public users can read only public-safe event statuses: `published`, `unlisted`, or `cancelled`.
- Admin users can read and write event documents directly.
- Representative event writes are intentionally not allowed directly from the browser. They go through trusted server actions using Firebase Admin SDK so `churchId`, audit fields, timestamps, slugs, and protected transitions cannot be forged.
- Registration and export collections remain admin-only in rules until their trusted workflows are implemented.

Storage:

- Public event flyer images can be read.
- Direct browser uploads and deletes remain blocked.
- Trusted server actions enforce representative access, file type, size, dimensions, safe names, and scoped paths before using Firebase Admin SDK.

## Required Indexes

Checked into `firestore.indexes.json` and referenced from `firebase.json`:

- `events`: `status ASC`, `visibility ASC`, `startsAt ASC`.
- `events`: `churchId ASC`, `status ASC`, `visibility ASC`, `startsAt ASC`.
- `events`: `churchId ASC`, `startsAt DESC`.

### Phase 1: Existing-Site Corrections and Events Foundation

- Add event data types and taxonomy.
- Add read-only public event repository.
- Add public `/events` and `/events/[eventSlug]` routes.
- Add homepage and church-profile upcoming event sections.
- Add portal dashboard events entry point.
- Add Firestore and Storage rules placeholders that preserve server-side write enforcement.
- Keep existing church workflows unchanged.

### Phase 2: Event Administration

- Add server actions for create, edit, publish, cancel, archive, and duplicate.
- Enforce church access with `requireRepresentativeChurchAccess()`.
- Add flyer upload validation and server-side Firebase Storage writes.
- Add audit logs for meaningful event changes.

### Phase 3: Community Calendar

- Add month, agenda, and list views.
- Add indexed Firestore filters for date, church, city, event type, audience, language, and registration status.
- Add ICS and Google Calendar links.
- Add event structured data and sitemap entries.

### Phase 4: Registration

- Add schema-driven form builder and presets.
- Add trusted server transactions for capacity and waitlist placement.
- Add confirmation emails and secure registrant tokens.
- Add management UI for registrations and check-in.

### Phase 5: Reports

- Add PDF, XLSX, and optional CSV exports.
- Sanitize spreadsheet values to prevent formula injection.
- Add secure temporary file cleanup and scheduled final reports.

### Phase 6: Policies, Accessibility, and QA

- Update privacy, terms, and listing/event guidelines.
- Add retention documentation.
- Add security-rule tests and cross-church authorization tests.
- Add mobile and keyboard-accessibility QA.

## Required Indexes

Initial event reads may require:

- `events`: `status ASC`, `startsAt ASC`
- `events`: `churchId ASC`, `status ASC`, `startsAt ASC`
- `events`: `slug ASC`

Single-field slug lookup uses Firestore's automatic single-field index.

## Required Environment Variables

No new environment variables are required for this phase beyond the existing Firebase and site configuration. Flyer upload requires the existing Firebase Storage Admin configuration to be valid.

## Local Testing Commands

- `npm run test:event-validation`
- `npm run test:directory-routing`
- `npm run lint`
- `npm run build`

Firebase emulator/rules tests should be added before public registration and report workflows are enabled, especially for registration privacy and any future direct client upload path.

## Security Notes

- Public event reads must never include private registrations.
- Browser writes to events, registrations, exports, and flyers remain disabled until server-side workflows and rules are complete.
- Cross-church access must derive church ownership from authenticated representative records, never from a client-provided church ID alone.
- This phase enforces representative event ownership in trusted server actions because the current representative model uses random `churchRepresentatives` document IDs. Firestore rules cannot safely query arbitrary representative documents by church/user pair without a deterministic access mirror. If direct client Firestore writes are ever needed, add a deterministic `churchEventAccess/{churchId_userId}` or equivalent rules-friendly model first.

## Known Follow-Up

- Native registration, report generation, scheduled emailing, recurring event editing, admin category management, and event-manager-only roles are not part of this phase.
- Firebase data migration/backfill is not required for existing churches because no existing records are modified.
- No fake production events should be seeded.
