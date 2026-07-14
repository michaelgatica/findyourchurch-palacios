# Launch Checklist

## Public visitor checks

- Homepage loads.
- Directory loads.
- Search works.
- Filters work.
- Clear filters works.
- Result count updates.
- Church profile loads.
- Call, email, website, and directions buttons work.
- Submit church flow works.
- Claim church flow works.
- About page loads.
- Contact page loads.
- Privacy page loads.
- Terms page loads.
- Listing guidelines page loads.
- Donation buttons and embed appear only when donations are enabled.

## Admin checks

- Admin login works.
- Non-admin cannot access `/admin`.
- Approve submission works.
- Deny submission works.
- Request changes works.
- Approve claim works.
- Approve update works.
- Audit logs are created.
- Email logs are created.
- Pending queues show accurate counts.

## Representative checks

- Portal login works.
- Non-representative cannot access `/portal`.
- Approved representative can access `/portal`.
- Representative can open `/portal/events`.
- Representative can create an event draft.
- Representative can upload a JPG, PNG, or WebP flyer.
- Representative can publish an event.
- Published event appears on `/events`, the church profile, and its event detail page.
- Representative can edit, duplicate, cancel, archive, restore, and delete draft events according to status rules.
- Representative can open `/portal/events/[eventId]/registration`.
- Representative can configure an internal registration form.
- Representative can submit a manual registration.
- Representative can view registration details and audit history.
- Representative can check in a registration.
- Representative can export a PDF roster.
- Representative can export an XLSX workbook.
- Representative cannot access another church's registration dashboard or exports.
- Edit church works.
- Auto-publish true works.
- Auto-publish false creates pending update request.
- Editor invite works.
- Second editor invite is blocked.
- Ownership transfer request works.
- Messages work.
- Suspended representative is blocked.

## Security checks

- Public users cannot view pending submissions.
- Public users cannot view internal notes.
- Representative cannot edit another church.
- Representative cannot read or edit another church's event in `/portal/events/[eventId]/edit`.
- Direct browser Firestore writes to event records remain blocked unless using trusted server actions.
- Direct browser Firestore writes to registration records, forms, counters, tokens, exports, jobs, and audit logs are blocked.
- Direct browser Storage uploads to event flyer paths remain blocked.
- Direct browser Storage reads of private registration exports are blocked.
- Only primary owner can invite editor.
- Only primary owner can request ownership transfer.
- Admin-only actions are still protected server-side.
- `.env.local` is not tracked by Git.
- No service account key or email provider secret is exposed client-side.

## Content and data checks

- Demo/sample churches are removed or clearly labeled.
- Workflow test data is removed if tests were run against live Firebase.
- Duplicate listings have been reviewed.
- Real church contact details have been verified.
- Last verified dates are reasonable.

## Deployment checks

- `NEXT_PUBLIC_SITE_URL` matches the live domain.
- `docs/community-ministry-hub-launch-readiness.md` has been reviewed.
- `docs/community-ministry-hub-staging-qa.md` has been completed against a nonproduction environment.
- `docs/community-ministry-hub-security-acceptance.md` has a launch-owner decision for residual risks.
- `APP_ENV` and `NEXT_PUBLIC_APP_ENV` are set correctly for the target environment.
- The admin nonproduction banner appears in staging and does not appear in production.
- Firebase Auth is enabled.
- Firestore named database is configured.
- Firestore indexes from `firestore.indexes.json` are deployed.
- Storage bucket exists and uploads work.
- Firestore rules reviewed.
- Storage rules reviewed.
- Event flyer upload is tested with a representative-owned church.
- Unsafe flyer uploads are rejected.
- External registration URLs require HTTPS.
- `REGISTRATION_TOKEN_SECRET` is configured in production.
- `REGISTRATION_JOBS_CRON_SECRET` is configured in production.
- Registration cron calls `POST /api/jobs/registration` with the `x-cron-secret` header.
- `/admin/ops` shows no critical production failures.
- `/admin/events` opens for the platform admin account.
- `/admin/event-reports` opens for the platform admin account.
- `/admin/event-categories` opens for the platform admin account.
- Registration confirmation, waitlist, reminder, digest, and final-report emails are tested with the real provider.
- Registration exports expire and are not readable through direct Storage URLs.
- Email provider configured and tested.
- Donation URL configured.
- Sitemap verified.
- Mobile layout checked on a phone-sized viewport.

## Hosted staging infrastructure checkpoint

Focused staging infrastructure evidence recorded July 13, 2026:

- Firebase project: `findyourchurch-staging-2026`.
- Firestore database: `findyourchurchpal`.
- Storage bucket: `findyourchurch-staging-2026.firebasestorage.app`.
- Firebase App Hosting backend: `community-hub-staging` in `us-central1` with the `staging` environment and `nodejs22` runtime.
- Staging URL: `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app`.
- Latest focused local-source App Hosting rollout: succeeded July 13, 2026.
- Authenticated admin and representative portal areas visibly show the `STAGING` warning.
- The five fictitious QA accounts share an IAM-controlled password stored only as staging Secret Manager secret `FYC_STAGING_QA_PASSWORD`; App Hosting has no access to it.
- Staging Storage rules deployed; emulator rule tests and live staging trusted-upload/access tests passed.
- Church A representative created and published a fictitious event with a real staging Storage flyer; the flyer rendered publicly at 1200x675.
- Church A could not open Church B event administration or platform admin pages.
- Platform admin opened `/admin/events`, `/admin/event-reports`, `/admin/event-categories`, and `/admin/ops`.
- Public hosted smoke checks passed for homepage, directory, event visibility, direct unlisted behavior, cancellation, flyer, and missing-flyer content.
- Protected scheduler endpoint denied missing/invalid authentication, rejected the wrong environment, request bodies, and unexpected methods, and kept its secret out of client bundles and inspected logs.
- Cloud Scheduler API is enabled only in staging. Enabled job `community-hub-registration-jobs-staging` runs every 15 minutes in `America/Chicago` with three provider retries.
- Hosted scheduler certification completed digest, reminder, closing-report, export/token-cleanup, and retention-cleanup jobs; verified overlap lease, retry recovery, cross-church isolation, correlation logs, and zero duplicate email-log entries.
- `/admin/ops` was authenticated as the fictitious platform administrator and displayed the `STAGING` banner, scheduler events, 15 email templates, SMTP-blocked state, and disabled send controls.
- SMTP is blocked pending a staging-safe provider and credentials.
- Full accessibility, responsive, cross-browser, performance, dependency-upgrade, production, and release-certification work was not performed in this checkpoint.

This checkpoint remains blocked on live SMTP delivery. Scheduler infrastructure is ready; this is not approval for production deployment.

## Hosted accessibility and browser checkpoint

Focused staging evidence recorded July 14, 2026:

- Hosted URL and Firebase project remained `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app` and `findyourchurch-staging-2026`.
- Chromium, installed Microsoft Edge, and Firefox completed public, representative, and platform-administrator workflow coverage.
- Standalone Chrome was not installed; WebKit/Safari was unavailable. Neither is marked passed.
- Seven viewport widths from 320px through 1920px passed public overflow checks in all three tested engines.
- Representative registration, form builder, check-in, export, and administrator surfaces passed 320px checks; registration passed 200 percent zoom/reflow.
- Sixty-six axe route/state scans completed with no critical or serious findings after corrections.
- Keyboard skip navigation, mobile navigation, account menu arrows/Escape/focus return, invalid-field focus, repeating attendee labels, form-builder controls, check-in actions, and admin tables passed.
- All identified high findings were fixed: unnamed admin controls, focus/landmark/live-region defects, ambiguous builder controls, Firefox 320px overflow, and Firefox multipart event-save navigation.
- Each tested engine created a fictitious draft, confirmed draft privacy, uploaded a staging flyer, published the event, verified the flyer publicly, toggled/restored check-in, and downloaded PDF and XLSX reports.
- Church A/B isolation and limited-manager/platform-admin boundaries passed in every tested engine.
- Remaining medium issues: event denials use church-oriented not-found wording, and Firefox/Next can log exact `Connection closed.` RSC errors or React 419 client-render recovery after successful representative navigation without workflow loss. Remaining environment gaps: native screen reader and WebKit/Safari.
- SMTP remains a separate full-certification blocker; no production deployment or production data change occurred.

Accessibility/browser recommendation: **ready for performance and SEO validation**. This is not production approval.

## Hosted performance and SEO checkpoint

Focused staging evidence recorded July 14, 2026:

- [x] Large staging seed was dry-run before confirmation and stayed pinned to `findyourchurch-staging-2026` / `findyourchurchpal`.
- [x] Dataset contains 131 events, 1,125 registrations, multiple churches/statuses/modes, and exactly 500 registrations on the export/pagination fixture.
- [x] Public response/render measurements passed for homepage, directory, event listing/filtering, event detail, church upcoming events, and flyers.
- [x] Registration dashboard uses 25-row cursor pages; admin events/reports use 50-row cursor pages; check-in, categories, operations, sitemap, and cleanup queries are bounded.
- [x] All 25 required staging composite indexes are ready; no new index was required.
- [x] Atomic capacity/idempotency/waitlist/cancellation/promotion/aggregate/rate-limit tests passed without oversubscription.
- [x] Six 500-registration PDF variants and one XLSX workbook passed time, size, pagination, long-text, totals, selected-field, participant, summary-sheet, and formula-safety checks.
- [x] Scheduler batch, retry, overlap, cleanup, retention, resume, idempotency, and operational-log checks passed.
- [x] Titles, descriptions, canonical URLs, Open Graph, structured data, robots, sitemap, unlisted privacy, and token non-disclosure passed on hosted staging.
- [x] Google Calendar and ICS start/end, timezone, venue, public URL, and cancellation behavior passed.
- [x] Supported operating limits are documented in `docs/community-ministry-hub-staging-qa.md`.
- [ ] Provider-backed staging SMTP delivery is still required.
- [ ] Native screen-reader and WebKit/Safari evidence remain environment gaps.

Performance/SEO result: **still blocked from full staging certification** on the three remaining items above. Do not deploy to production from this checkpoint.

## Cleanup safety

- Preview demo cleanup with `npm run cleanup:demo-data -- --dry-run`.
- Preview workflow cleanup with `npm run cleanup:test-data -- --dry-run`.
- Preview Community Hub staging reset with `npm run reset:community-hub-staging -- --dry-run` when using staging seed data.
- Only use `--confirm` after reviewing what will be removed.
- Do not run destructive cleanup against production unless you understand exactly what the script will delete.

## Final Launch Test Flow

### Public visitor

1. Visit homepage.
2. Browse directory.
3. Search and filter churches.
4. Open a church profile.
5. Use call, email, website, and directions buttons.
6. Submit a test church.
7. Confirm the pending submission message appears.

### Admin

1. Sign in as admin through the real UI.
2. View the pending submission.
3. Request changes on one test submission.
4. Deny a test submission.
5. Approve a test submission.
6. Confirm the approved church appears publicly.
7. Review email logs and audit logs.

### Claim and representative

1. Visit a public church profile.
2. Click `Claim This Church`.
3. Create or sign in as a user.
4. Submit the claim.
5. Approve the claim in admin.
6. Sign into the representative portal.
7. Edit the listing.
8. Test `autoPublishUpdates = true`.
9. Test `autoPublishUpdates = false`.
10. Approve the pending update in admin.
11. Send an admin message from the portal.
12. Invite an editor.
13. Submit an ownership transfer request.

### Community events

1. Sign in as a verified representative.
2. Open `/portal/events`.
3. Create a draft event.
4. Upload a valid flyer image.
5. Publish the event.
6. Confirm it appears on `/events`.
7. Open the event detail page.
8. Confirm the church profile shows the event.
9. Test an external HTTPS registration URL.
10. Confirm an HTTP registration URL is rejected.
11. Duplicate the event and confirm the copy is a draft.
12. Cancel the published event and confirm the public page shows the cancellation notice.
13. Archive the event.
14. Confirm a representative from another church cannot edit the event.

### Event registration

1. Create or edit an event with `Internal custom registration`.
2. Configure the registration form using a preset.
3. Add one custom optional field and one required field.
4. Publish the event.
5. Visit `/events/[eventSlug]/register`.
6. Submit a registration.
7. Confirm the confirmation page shows a nonsequential confirmation number.
8. Confirm the registrant receives the registration email.
9. Submit until capacity is reached and confirm waitlist behavior if enabled.
10. Open `/portal/events/[eventId]/registration`.
11. Search by name and confirmation number.
12. Open the registration detail page.
13. Check in the registrant.
14. Cancel a registration and confirm capacity/waitlist behavior.
15. Export a PDF roster.
16. Export an XLSX workbook.
17. Email a final report to an authorized recipient.
18. Confirm another church representative cannot view the registrations.

### Security

1. Confirm a non-admin cannot use `/admin`.
2. Confirm a non-representative cannot use `/portal`.
3. Confirm a representative cannot edit another church.
4. Confirm a suspended representative cannot edit.

## Launch Day Manual Test

### Public

1. Visit the homepage on the live domain.
2. Visit the church directory.
3. Search and filter churches.
4. Open a church profile.
5. Test the Call button.
6. Test the Email button.
7. Test the Website button.
8. Test the Directions button.
9. Test the Claim This Church button.
10. Test the Submit Your Church form.
11. Confirm the donation modal opens if enabled.
12. Confirm the donation embed or iframe fallback renders if enabled.
13. Confirm the mobile layout on a phone-sized viewport.

### Admin

1. Sign in with the real admin account.
2. View the dashboard.
3. View pending submissions.
4. Approve a test submission.
5. Deny a test submission.
6. Request changes on a test submission.
7. Approve a claim request.
8. Toggle `autoPublishUpdates`.
9. View email logs if available.
10. View audit logs if available.

### Representative

1. Create or sign in as a test representative.
2. Submit a claim request.
3. Have admin approve the claim.
4. Log into the representative portal.
5. Edit the listing with `autoPublishUpdates=true`.
6. Edit the listing with `autoPublishUpdates=false`.
7. Have admin approve the pending update.
8. Send a message to admin.
9. Invite one editor.
10. Verify the second editor invite is blocked.
11. Request ownership transfer.

### Security

1. Confirm a non-admin cannot access `/admin`.
2. Confirm a non-representative cannot access `/portal`.
3. Confirm a suspended representative cannot edit.
4. Confirm a representative cannot edit another church.
5. Confirm pending submissions do not appear publicly.
6. Confirm pending claims do not appear publicly.
7. Confirm draft events do not appear publicly.
8. Confirm private registration data does not appear on public event pages.
9. Confirm private registration exports cannot be opened directly from Storage.

## Automated Pre-Launch Checks

Run these locally before requesting deployment:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
npm run test:event-validation
npm run test:directory-routing
npm run test:registration-validation
npm run test:registration-reports
npm run test:registration-scheduler
npm run test:platform-launch-readiness
npm run test:staging-validation
npm run test:event-security
npm run test:registration-emulator
npm run lint
npm run build
```

Only run live Firebase workflow tests when the environment is intentionally pointed at a non-production project or when production test data has been explicitly approved.
