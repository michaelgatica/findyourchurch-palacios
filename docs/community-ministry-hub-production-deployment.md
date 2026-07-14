# Community Ministry Hub Production Deployment Plan

This is a plan only. Do not execute these steps until staging validation has passed and the launch owner approves a production window.

## Canonical And Redirect Policy

The intended production canonical origin is `https://findyourchurchpalacios.org` using HTTPS and the non-`www` host. This is a deployment decision, not a claim that DNS, certificates, or redirects are currently active.

- Redirect `http://findyourchurchpalacios.org/*` to `https://findyourchurchpalacios.org/*` with a permanent redirect after HTTPS is ready.
- Redirect `https://www.findyourchurchpalacios.org/*` to the matching path and query on `https://findyourchurchpalacios.org/*`.
- Redirect Firebase `web.app`, `firebaseapp.com`, and App Hosting default-domain production traffic to the canonical host where the provider permits; these domains must never be emitted as production canonical or Open Graph origins.
- Keep `findyourchurch.org` outside this launch policy unless it is separately configured and approved later.
- Preserve current legacy church-route redirects to the canonical state/city/church route.
- Use one canonical event route, `/events/[eventSlug]`; any legacy or duplicate event path must permanently redirect to it without registration-management or export tokens.
- Never place confirmation identifiers, registration-management tokens, export tokens, or scheduler secrets into redirects, canonical URLs, sitemap entries, Open Graph tags, structured data, analytics events, or public logs.

Production sitemap policy: include published churches and upcoming published public events; exclude draft, pending, unlisted, cancelled, past, registration, confirmation, portal, admin, management-token, and export-token routes. Past published details may remain indexable when opened directly, but remain out of the upcoming sitemap. Cancelled details remain direct/noindex with `EventCancelled` structured data. Verify this policy again only after the production domain is actually configured.

## Required Pre-Launch Evidence

- Staging Firebase project or preview environment verified.
- SMTP delivery verified with approved test recipients.
- Scheduler authentication and idempotency verified.
- Representative, platform admin, and anonymous workflows manually tested.
- Critical/high accessibility issues resolved.
- Dependency residual risks accepted in `docs/community-ministry-hub-security-acceptance.md`.
- Backup and rollback procedures reviewed.

## Deployment Order

1. Production backup.
   - Confirm Firestore managed backup or export.
   - Confirm Storage backup/retention expectation.
   - Record current deployed application release.
   - Rollback condition: stop if backup status is unknown.
2. Environment-variable verification.
   - Set `APP_ENV=production`.
   - Set `NEXT_PUBLIC_APP_ENV=production`.
   - Set `NEXT_PUBLIC_SITE_URL=https://findyourchurchpalacios.org`.
   - Verify Firebase client/admin, SMTP, registration, scheduler, monitoring, and donation variables.
   - Rollback condition: stop if `/admin/ops` would fail critical checks.
3. Secret creation or rotation.
   - Create strong `REGISTRATION_TOKEN_SECRET`.
   - Create strong `REGISTRATION_JOBS_CRON_SECRET`.
   - Create or confirm `LISTING_VERIFICATION_CRON_SECRET`.
   - Create `EXPORT_SIGNING_SECRET` if export token revocation/signing is enabled.
   - Rollback condition: stop if secrets are missing or shared with staging.
4. Deploy Firestore indexes.
   - Deploy `firestore.indexes.json`.
   - Wait until required indexes are serving.
   - Rollback condition: pause app deployment if indexes fail.
5. Deploy Firestore rules.
   - Deploy `firestore.rules`.
   - Confirm public events are readable and private registration/admin collections are denied.
   - Rollback condition: immediately redeploy previous rules if public/private boundaries fail.
6. Deploy Storage rules.
   - Confirm public flyers read and private exports deny direct public access.
   - Rollback condition: redeploy previous rules if private export paths become public.
7. Deploy application/server.
   - Deploy reviewed commit only.
   - Confirm no production data migration is running automatically.
   - Rollback condition: redeploy previous application release if login, directory, events, or registration break.
8. Hosting/domain.
   - Confirm HTTPS and canonical `findyourchurchpalacios.org`.
   - Confirm `www` redirect policy.
   - Rollback condition: route traffic back to previous release if critical public pages fail.
9. SMTP configuration.
   - Confirm sender, reply-to, SPF, DKIM, DMARC.
   - Send approved production test email only.
   - Rollback condition: set event registration emails to disabled/console-equivalent only if safe, or pause registration opening.
10. Scheduler configuration.
   - Configure scheduler to call `POST /api/jobs/registration` with `x-cron-secret`.
   - Start with a controlled manual run.
   - Rollback condition: disable scheduler if duplicate sends or failures appear.
11. App Check.
   - If enabled, roll out in monitor mode first where supported.
   - Verify server actions and scheduler are not blocked.
   - Rollback condition: disable enforcement if valid traffic is blocked.
12. Domain verification and sitemap.
   - Check robots, sitemap, canonical URLs, Open Graph metadata.
   - Submit sitemap in Search Console when ready.
13. Smoke tests.
   - Homepage.
   - `/churches`.
   - `/events`.
   - Published event detail.
   - Event registration.
   - Portal event dashboard.
   - Admin events/reports/categories/ops.
14. Monitoring verification.
   - Confirm email failure, scheduler failure, export failure, and authorization-denial monitoring path.
15. Registration opening.
   - Enable internal registration only after smoke tests pass.
   - If needed, keep registration modes external until confidence is established.
16. Post-launch review.
   - Review logs after 1 hour, 24 hours, 72 hours, and 7 days.

## Maintenance Or Pause Points

Maintenance mode is not required for adding public event browsing. A temporary registration pause is recommended if:

- Rules or indexes are not fully deployed.
- SMTP has not been verified.
- Scheduler has not been verified.
- Export storage is not verified.

## Post-Deployment Smoke Test Checklist

- Public event listing loads.
- Draft events do not appear publicly.
- Unlisted event is not listed publicly.
- Cancelled event page shows cancellation message.
- Registration confirmation email arrives.
- Management link works.
- Representative can view only their church.
- Platform admin can view reports and ops checks.
- Direct Storage export URL is denied.
- Scheduler unauthorized call is denied.
