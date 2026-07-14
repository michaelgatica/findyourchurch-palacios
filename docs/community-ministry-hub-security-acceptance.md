# Community Ministry Hub Security And Risk Acceptance

Certification date: July 14, 2026

This record separates verified controls from risks that still require an owner decision. It is not production approval. After the initial read-only certification, the owner authorized a production infrastructure preflight and a guarded remediation rollout. That work configured monitoring, recovery controls, TTL, required indexes, Secret Manager bindings, SMTP, and App Check; deployed App Hosting revision `findyourchurch-palacios-build-2026-07-14-001`; and used temporary synthetic Auth/Firestore records for controlled access checks. Every synthetic identity, profile, representative record, audit record, and temporary church activity value was removed or restored after the checks. No merge to `main` occurred.

## Current Decision

**NO-GO for opening production registrations today.** Production SMTP delivery, monitoring, operational-record retention, App Check enforcement, Secret Manager binding, required indexes, canonical redirects, public routes, and controlled representative/admin access are now verified. Remaining launch blockers are the owner's required native screen-reader test, explicit acceptance or remediation of 9 remaining moderate dependency advisory nodes, the first managed Firestore backup plus isolated managed-backup restore, and an authorized live bounce test or explicit owner acceptance of the documented return-path/provider behavior.

The Community Ministry Hub changes may be prepared for review and merge, but deployment must remain gated on the blocking acceptance items at the end of this document.

## Production Infrastructure Preflight — July 14, 2026

Every production write explicitly targeted project `findyourchurch-24562`. The verified database is `findyourchurchpal` in `nam5`, the bucket is `findyourchurch-24562.firebasestorage.app`, and the App Hosting backend is `findyourchurch-palacios`. The Firebase CLI remained selected to staging; no command relied on its ambient selection.

| Area | Verified production evidence | Result / remaining gate |
| --- | --- | --- |
| Firestore recovery | Point-in-time recovery and database delete protection are enabled. Daily backups retain 14 days and Sunday weekly backups retain 84 days. A PITR clone completed into an isolated `recovery-*` database; representative `churches` and `locations` documents matched field counts and the recovery database was removed. | PITR recovery passed. No scheduled backup artifact exists yet, so the required managed-backup restore is still blocking. |
| Storage recovery | Seven-day soft delete was already active. A uniquely named fictitious object was uploaded, deleted, found as soft-deleted, restored, checksum/size matched, and deleted again. | Pass. Object versioning remains off; temporary private exports continue to rely on soft delete plus application expiry. |
| App Check | Production reCAPTCHA Enterprise provider is registered for the canonical/App Hosting domains. The served revision exchanged a reCAPTCHA Enterprise token for an App Check token with HTTP 200. Firestore, Storage, and Authentication were then atomically changed to `ENFORCED`. | Pass. An unattested Authentication probe is rejected with HTTP 401 and an attested browser request passes App Check and reaches normal Authentication validation. |
| Monitoring | Error Reporting API enabled; three email channels, one content-matched HTTPS uptime check, 12 sanitized log metrics, and 13 threshold policies are enabled. A controlled configuration-failure incident opened, emailed `michaelgatica@gmail.com`, and resolved. The uptime policy's stale check ID was corrected to the verified production check; the continuously failing homepage then opened a real critical incident after five minutes and delivered the critical outage email to the same mailbox. | Pass for the verified recipient and critical website-unavailable path. Support and escalation mailbox receipt still needs confirmation by their owners. |
| Cloud Logging retention | Production `_Default` retains 30 days and locked `_Required` retains 400 days. Firestore TTL policies for `auditLogs`, `emailLogs`, `eventScheduledJobs`, and `operationalEvents` are `ACTIVE`; all four production collections were empty when checked, so no historical backfill was required. | Infrastructure and application TTL configuration verified. |
| Canonical host | Apex DNS and App Hosting ownership/host/certificate are active. TLS hostname verification passed. The required `www` A and ownership TXT records resolve through public DNS. App Hosting reports `HOST_ACTIVE`, `OWNERSHIP_ACTIVE`, and `CERT_ACTIVE`, with reconciliation complete. | Pass. HTTPS requests to `/`, `/churches`, and `/community-events` return path-preserving 308 redirects to the canonical non-`www` host. |
| SMTP provider | Owner confirmation identifies Namecheap Stellar Plus. The production credential authenticates through the provider's canonical TLS endpoint, is stored as enabled Secret Manager secret `FYC_PROD_SMTP_PASSWORD`, and is available to the App Hosting compute service account. A controlled production message was accepted with SMTP 250 and received at the approved Gmail mailbox. Received headers show SPF, DKIM, and DMARC pass, TLS 1.3, the noreply Return-Path, and the support Reply-To; the required unmonitored-mailbox notice was present. | Provider delivery passes. Namecheap documents 200 messages/hour/domain and 100 recipients/message for Stellar Plus. A destructive invalid-recipient bounce was not sent because no such recipient was authorized, so live bounce handling remains an explicit launch decision. |
| Controlled public and role smoke | The new revision served `/`, `/events`, a real church profile, `/portal/login`, and `/admin/login` without a Server Components/index error. A temporary synthetic administrator reached `/admin`, events, reports, categories, and operations. A temporary church editor reached portal, events, event-create, church-edit, and team pages and was denied `/admin/events`. | Pass for public, representative, and platform-admin routing/authorization. The only production event belongs to the assigned smoke church, so a distinct live cross-church event URL was unavailable; staging isolation and emulator evidence remain authoritative for that case. |
| Secret storage | Six production secrets now hold the Firebase client key, SMTP password, registration token, export signing key, Scheduler token, and listing-verification token. App Hosting access was granted and plaintext backend overrides were removed. `apphosting.yaml` references Secret Manager for every sensitive value. | Pass. The production `/admin/ops` page reported 26 passed, 2 warnings, and 0 failed configuration checks without displaying secret values. |

The owner explicitly waived SMTP credential rotation. That waiver removes only the rotation action; it does not accept plaintext backend secret storage, an invalid Secret Manager version, sender mismatch, or missing bounce evidence.

## Production Blocker Closure Evidence

Owner decisions are recorded without inference:

| Decision | State | Evidence / remaining condition |
| --- | --- | --- |
| Sender and support routing | Approved | Staging uses `noreply@findyourchurchpalacios.org`; `Reply-To` and the required text/HTML notice direct replies and questions to `support@findyourchurchpalacios.org`. The application rejects a noreply configuration with any other reply-to address. |
| App Check | Approved and enforced | Production token exchange returned HTTP 200, Firestore/Storage/Authentication are `ENFORCED`, an unattested Authentication request is rejected, and an attested browser request succeeds through the App Check gate. |
| Monitoring stack and recipients | Approved | Google Cloud Monitoring, Error Reporting, and Cloud Logging selected. Three email channels and 13 enabled policies implement the owner's thresholds. A controlled alert was received through the approved channel. |
| Firestore backup / Storage recovery approach | Delegated and implemented in staging | Daily 14-day plus Sunday weekly 12-week Firestore schedules are configured. Storage keeps deleted objects for seven days; versioning is intentionally off for short-lived private exports. A fictitious object was deleted, restored, hash/size checked, and removed. The first scheduled Firestore backup and managed restore remain unverified. |
| Operational retention categories | Approved | TTL is active for audit, email, terminal Scheduler-job, and operational-event records. Current periods are 400, 180, 90, and 180 days respectively. Existing staging records were backfilled without registration answers or credentials. |
| Dependency risk | Still awaiting owner decision | Firebase Admin 14 passed compatibility recertification and removed two nodes. Audit remains 9 moderate, 0 high, 0 critical. No force fix or unsupported override was applied. |
| Native screen reader | Required before launch | Windows Narrator is installed, but an auditable native workflow run was not completed. Automated axe/keyboard evidence is not a substitute. |

SMTP provider evidence: Namecheap Shared Hosting Mail was exercised through its canonical TLS endpoint. Seven controlled staging messages were received: registration confirmation, waitlist confirmation, reminder, church-administrator notification, PDF report, XLSX report, and scheduled report. The production credential was subsequently bound through Secret Manager and a controlled production message was accepted with SMTP 250 and received at the approved Gmail address. SPF, DKIM, and DMARC passed; DMARC is monitoring policy `p=none`. The production headers showed TLS 1.3, the noreply Return-Path, the support Reply-To, and the universal unmonitored-mailbox notice. A destructive bounce test was not sent because no invalid recipient was authorized. The owner confirmed Stellar Plus; Namecheap documents 200 messages/hour/domain and 100 recipients/message for that plan.

The launch owner directed that SMTP credential rotation be omitted. That exception is recorded as an owner decision and is not silently treated as a security recommendation. The credential must still be supplied through a private secret channel and bound through Secret Manager; it is not placed in source, documentation, commits, screenshots, or the final report.

Staging Cloud Logging uses the project `_Default` bucket with 30-day retention. Event-report moderation and export actions are covered by the 400-day application audit category; safe authorization/rate-limit events are covered by the 180-day operational category. Registration answers, tokens, credentials, medical/minor details, and complete addresses are excluded from both structured alerts and retained operational summaries.

## Production Dependency Audit

Command run on July 14, 2026:

```text
npm audit --omit=dev --json
```

Result after safe remediation: 346 production dependencies; 9 moderate advisory nodes; 0 high; 0 critical. The 9 nodes reduce to two upstream vulnerabilities: PostCSS CSS-stringification XSS and UUID buffer-bound handling in UUID v3/v5/v6 when a caller supplies a buffer. Firebase Admin was upgraded from `13.10.0` to `14.1.0`, its documented Node 22 and modular-import requirements were satisfied, and the full local suite passed. That removed the Firestore and `google-gax` advisory nodes. Remaining parent packages are at the newest supported lines; npm's suggestions are incompatible downgrades, upstream major changes, or unsupported overrides. `npm audit fix --force` was not run.

Risk owner for every pending row is the platform technical owner, with explicit acceptance also required from the launch owner. The target date is August 14, 2026 or before production deployment, whichever comes first.

| Package | Direct or transitive | Dependency path | Severity | Vulnerability and affected code path | Public exposure | Available fix and breaking impact | Compensating controls | Launch decision | Owner / target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `next@15.5.20` | Direct | application -> `next` -> `postcss` | Moderate | Inherits PostCSS unescaped `</style>` CSS-stringification XSS. Next renders the public application and processes application-owned CSS. | Public Next runtime; no user-authored CSS or CSS template surface exists. | npm proposes an unsafe `next@9.3.3` downgrade; Next 16 is a major framework migration. No compatible Next 15 fix is published. | Static application CSS, no user CSS authoring, input validation, staging CSP review queued. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `postcss@8.4.31` | Transitive | application -> `next@15.5.20` -> `postcss@8.4.31` | Moderate | GHSA-qx2v-qp2m-jg93: XSS through unescaped `</style>` in CSS stringify output. | Processing is internal to Next; registrants and representatives cannot submit CSS. | Fixed in PostCSS 8.5.10, but Next 15 pins 8.4.31 exactly. An override is not a supported Next configuration and was not applied. | Same as the Next row; do not add user-controlled CSS generation. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `firebase-admin@14.1.0` | Direct | application -> `firebase-admin` -> Cloud Storage transport | Moderate | Inherits the remaining UUID/request advisory through its optional Storage dependency. Firebase Admin is used for Firestore, Auth, and Storage server operations. | Server-only; no Admin credentials or APIs are shipped to the browser. | Version 14.1.0 is current and passed compatibility recertification. npm now suggests an incompatible downgrade to `10.3.0`, which was rejected. | Node 22 runtime, modular imports, managed App Hosting service account, staging/project guards, rules tests, church-scoped service authorization. | Pending acceptance for the residual Storage path; blocks production until accepted or upstream-remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `@google-cloud/storage@7.21.0` | Transitive/optional | application -> `firebase-admin@14.1.0` -> `@google-cloud/storage` -> `gaxios` / `retry-request` / `teeny-request` | Moderate | Inherits UUID-related request-transport advisories. Used for trusted flyer and private export Storage operations. | Server-only trusted upload/export path. | 7.21.0 is the latest compatible release. npm's suggested Firebase Admin downgrade is incompatible and does not provide a supported current stack. | Browser writes denied, upload type/size/dimension checks, church ownership enforcement, private export paths. | Pending acceptance; blocks production until accepted or safely upgraded upstream. | Platform technical owner + launch owner / 2026-08-14 |
| `gaxios@6.7.1` | Transitive | application -> Firebase Admin -> Cloud Storage transport -> `gaxios` -> `uuid@9.0.1` | Moderate | Inherits UUID advisory. Used for server-side Google HTTP transport. | Server-only. | A direct major override would violate the parent package range and was not applied; the Firestore branch now uses fixed `gaxios@7`. | No application call supplies UUID output buffers; service account remains server-side. | Pending acceptance; blocks production until accepted or safely upgraded upstream. | Platform technical owner + launch owner / 2026-08-14 |
| `retry-request@7.0.2` | Transitive | application -> Firebase Admin -> Cloud Storage -> `retry-request` -> `teeny-request` | Moderate | Inherits the UUID advisory through the legacy Storage request transport. | Server-only. | Version 8 is an upstream major dependency change; the Firestore branch now uses fixed `retry-request@8`. | Trusted server paths, bounded retries controlled by upstream library, no public transport API. | Pending acceptance; blocks production until accepted or safely upgraded upstream. | Platform technical owner + launch owner / 2026-08-14 |
| `teeny-request@9.0.0` | Transitive | application -> Firebase Admin -> Cloud Storage / `retry-request` -> `teeny-request` -> `uuid@9.0.1` | Moderate | Inherits UUID advisory. Used by the server-side Storage request stack. | Server-only. | Version 10 is an upstream major dependency change; the Firestore branch now uses fixed `teeny-request@10`. | Same server-only controls; no caller-supplied UUID buffer. | Pending acceptance; blocks production until accepted or safely upgraded upstream. | Platform technical owner + launch owner / 2026-08-14 |
| `exceljs@4.4.0` | Direct | application -> `exceljs` -> `uuid@8.3.2` | Moderate | Inherits UUID buffer-bound advisory. ExcelJS is used for authorized XLSX exports. | Authenticated church-scoped export route; not a public UUID API. | npm proposes the older `exceljs@3.4.0`; no fixed newer ExcelJS release is available. The downgrade is unsupported for this application. | Church-scoped authorization, private Storage, 24-hour expiry, 1,000-registration cap, 10 MB cap, formula-injection escaping. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `uuid@8.3.2` and two `uuid@9.0.1` copies | Transitive | ExcelJS; Storage `gaxios`; Storage `teeny-request` | Moderate | GHSA-w5hq-g745-h8pq: missing buffer bounds check in UUID v3/v5/v6 when `buf` is supplied. | No application route accepts or forwards a UUID output buffer. Application-owned identifiers use Node `crypto.randomUUID`; transitive callers use their internal ID paths. | Fixed at UUID 11.1.1, outside the parent packages' declared major ranges. Direct overrides were not applied. | Do not expose transitive UUID APIs; keep export and Admin SDK paths authenticated and server-only. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |

## Security Control Acceptance Matrix

| Control | Evidence actually run or inspected | Result | Residual risk / launch impact |
| --- | --- | --- | --- |
| Public registration reads | Firestore rules deny browser access to `eventRegistrations`; emulator rules and registration-emulator suites exercise anonymous access. | Pass | Production rules must be deployed only after backup and index readiness. |
| Public registration list | Rules allow registration records only to admins and deny untrusted writes; public route reads a sanitized confirmation lookup only. | Pass | Re-run deployed rules tests after production rules deployment. |
| Cross-church registration access | Service authorization requires matching event/church representative access; emulator, hosted Church A/Church B, and live staging tests passed. A temporary production church editor authenticated successfully and was denied platform administration. | Pass | Production had no distinct other-church event/registration fixture, so live cross-church event access remains covered by staging/emulator evidence rather than an invented production record. |
| Cross-church event administration | Trusted server services enforce church/event ownership; Church A could not open Church B event administration; limited event manager could not access platform admin. The controlled production editor/admin fixtures were removed after route checks. | Pass | The only production event belonged to the assigned smoke church; no unrelated production event was modified or created merely to repeat this denial. |
| Cross-church Storage access | Browser writes are denied; trusted server upload checks church/event ownership. Storage emulator and live staging isolation tests passed. | Pass | Production bucket identity must be rechecked before rules deployment. |
| Private exports | `private/event-exports/{churchId}/{eventId}` denies all browser access; download route checks authenticated church scope and expiry. | Pass | Production signing secret must be unique and stored in Secret Manager. |
| Export expiry | Export records expire after 24 hours; expired download is denied and cleanup deletes bounded expired records. Report and hosted scheduler suites passed. | Pass | Configure the production cleanup schedule and alert on failures. |
| Management tokens | Raw tokens are returned only to intended flows; Firestore stores a secret hash as the document ID; expired/revoked tokens fail; normal tokens expire after 180 days. | Pass | Rotating `REGISTRATION_TOKEN_SECRET` revokes existing links; launch communications must account for that. |
| Unlisted enumeration | Public list queries require `published + public + wasPublished`; rules deny list queries for unlisted events while allowing a known direct document link. Rules, hosted smoke, and SEO/sitemap tests passed. | Pass | Re-run after production index/rules deploy. |
| Never-published cancelled drafts | Direct public access requires `wasPublished`; cancelled unpublished fixture is denied. Firestore rules test passed. | Pass | None beyond post-deploy rules verification. |
| Scheduler authentication | Endpoint requires `REGISTRATION_JOBS_CRON_SECRET` and environment guard; unauthorized hosted request denied and authorized scheduler certification passed. | Pass | Production scheduler secret and job must be created together; never reuse staging. |
| Email idempotency | Scheduled jobs use deterministic idempotency keys and `deliveryCompletedAt`; hosted duplicate execution produced zero duplicate email-log entries. | Pass for application behavior | Provider-backed delivery, bounce handling, and provider message IDs remain untested and block production. |
| Sensitive log exclusion | Email console output omits bodies and addresses except recipient domain; email error redaction removes credentials; registration answer values are omitted from audit notes; scheduler metadata is counts/status only. Source audit and staging email redaction test passed. | Pass with gaps | Authorization-denial and rate-limit telemetry is incomplete; log sink controls and retention remain production prerequisites. |
| App Check | reCAPTCHA Enterprise is active in staging monitor mode; hosted token exchange returned HTTP 200. | Pass in staging | Owner requires production enforcement at launch; valid-client smoke tests must pass immediately after enforcement. |
| Rate limiting and bot controls | Registration honeypot is active; per-event/request-identity limit is 8 submissions per 15 minutes; duplicate/idempotency records are transactionally enforced. Public event reports also use a honeypot and hashed request metadata. App Check is enforced for Authentication, Firestore, and Storage. | Pass | Application-layer limits and App Check are active; distributed high-volume abuse remains a monitored residual risk. |
| Environment separation | Staging guards check `APP_ENV`, client/admin project IDs, Storage bucket, database, allowed hostname, and `PRODUCTION_FIREBASE_PROJECT_ID`. Admin/portal visibly show `STAGING`. | Pass | Production deployment must positively confirm every identifier before each write. |

## Logging Privacy Review

The following must never be copied to `operationalEvents`, infrastructure logs, screenshots, or incident tickets: registration answers, passwords, private keys, API/SMTP/scheduler/token secrets, raw management/export tokens, child names, allergy/medical data, emergency contacts, full street addresses, or complete recipient lists.

Verified safe patterns:

- Console email logging records recipient domain, subject, attachment count, and `body=omitted`.
- Transactional email failure logging redacts SMTP username/password and provider API keys and omits the body.
- Registration update audit entries explicitly omit answers.
- Scheduler events record job ID/type, attempts, counts, retry state, and safe error messages—not registration payloads.
- Public event-report operations log event/report identifiers and reason only; reporter details remain in the private report record.

Known monitoring gaps:

- Authorization denials are enforced but do not consistently create an `operationalEvents` record.
- Registration rate-limit and capacity rejections fail safely but do not consistently emit dedicated operational event types.
- Successful event/registration/export activity is primarily in `auditLogs` and `emailLogs`, not one unified external monitoring stream.
- Audit, email, scheduler-job, and operational-log retention durations are not approved or enforced by a cleanup job.

These gaps do not weaken the authorization decision itself, but production monitoring and retention approval are launch conditions.

## Accepted, Deferred, And Pending Risks

| Risk | State | Compensating control | Risk owner | Target | Launch impact |
| --- | --- | --- | --- | --- | --- |
| 9 moderate production advisory nodes | Pending acceptance | Server-only exposure limits, no user CSS, no caller-supplied UUID buffers, authenticated private exports; Firebase Admin 14 compatibility recertified | Platform technical owner + launch owner | 2026-08-14 / before deploy | Blocking until explicitly accepted or remediated |
| Provider-backed SMTP | Production delivery certified; owner waived credential rotation | Enabled Secret Manager binding, SMTP 250 acceptance, Gmail receipt, SPF/DKIM/DMARC pass, TLS, support Reply-To/notice, Return-Path, and staging attachment evidence | Ministry operations owner | Before registrations open | Delivery closed; an authorized live bounce or explicit acceptance of the observed provider handling remains blocking |
| App Check | Owner approved enforcement; completed | Production exchange HTTP 200; Authentication/Firestore/Storage `ENFORCED`; unattested request rejected; attested browser request passed | Platform technical owner | Completed July 14, 2026 | Closed; roll back only if verified legitimate clients are blocked |
| External alerts | Production configured and received | Three channels, 13 policies, controlled configuration alert delivery, and a real critical five-minute website-unavailable alert; safe structured log fields only | Operations owner | Completed 2026-07-14 | Closed for the verified launch-owner channel; support/escalation owners still confirm their mailbox receipt |
| Authorization/rate-limit operational telemetry incomplete | Deferred | Enforcement still fails closed; infrastructure logs available | Platform technical owner | Within 30 days of launch, with launch-owner acceptance | Conditional blocker |
| Native screen-reader evidence unavailable | Pending external test | Axe and keyboard/semantic tests have zero critical/serious findings | Accessibility/launch owner | Before deploy | Blocking for full GO |
| Native Safari hardware unavailable | Documented limitation | Chromium, Edge, Firefox, and Playwright WebKit hosted suites passed | QA/launch owner | Post-launch device matrix unless owner elevates | Not blocking by default |
| Audit/email/job/log retention | Approved and enforced in staging | Active Firestore TTL plus safe superadmin summaries; 605 existing records backfilled | Privacy owner + operations owner | Deployment window | Blocking until production TTL is verified |
| Async export queue not implemented beyond 1,000 records | Accepted design limit pending owner sign-off | Hard 1,000-registration and 10 MB caps; tested 500-record exports | Platform technical owner | Before expansion beyond local launch | Not blocking at Palacios scale if accepted |

## Blocking Acceptance Checklist

- [ ] Launch owner accepts or remediates all 9 remaining moderate dependency advisory nodes.
- [x] Ministry operations certifies provider-backed registration, waitlist, reminder, administrator, PDF, XLSX, and scheduled-report delivery to the approved staging recipient.
- [ ] Accessibility/QA owner completes the required native screen-reader checks. The owner explicitly requires testing; residual-risk acceptance is not substituted.
- [x] Platform/launch owner requires App Check enforcement at launch; staging monitor-mode token generation is certified.
- [x] Operations owner approved the alert stack, recipients, thresholds, and escalation; production resources and launch-owner delivery are verified.
- [x] Privacy/operations approved retention for audit, email, terminal Scheduler, and operational records; staging TTL is active.
- [x] Launch owner directed that SMTP credential rotation be omitted; record the exception without reproducing the credential.
- [x] Bind the approved noreply credential through production Secret Manager and verify sender, delivery, authentication headers, Return-Path, support Reply-To, and the unmonitored-mailbox notice without exposing it.
- [ ] Run an authorized invalid-recipient bounce test or record explicit owner acceptance of the observed Return-Path/provider behavior.
- [ ] Record the first completed Firestore managed backup and a non-destructive managed restore/clone check. The schedules exist, but the backup list still contains zero artifacts at the latest poll.
- [x] Production PITR, database delete protection, managed-backup schedules, and Storage soft-delete protection are confirmed; PITR clone and Storage object recovery passed.
- [x] Production App Check token exchange and enforcement pass for Authentication, Firestore, and Storage.
- [x] Production SMTP credential is privately bound and controlled delivery/receipt/authentication headers pass.
- [x] Controlled public, church-editor, and platform-admin production smoke passes; temporary records were cleaned up.
- [x] App Hosting reports active `www` ownership/host/certificate state and path-preserving HTTPS 308 redirects pass.
- [ ] All remaining production identifiers, rules, Scheduler, managed-backup restore, and SMTP bounce decision checks pass in the deployment window.

Until every blocking box is resolved, the production recommendation remains **NO-GO**.
