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

## Security Notes

- Public event reads must never include private registrations.
- Browser writes to events, registrations, exports, and flyers remain disabled until server-side workflows and rules are complete.
- Cross-church access must derive church ownership from authenticated representative records, never from a client-provided church ID alone.

## Known Follow-Up

- Native registration, report generation, and scheduled emailing are not part of the first foundation commit.
- Firebase data migration/backfill is not required for existing churches because no existing records are modified.
- No fake production events should be seeded.
