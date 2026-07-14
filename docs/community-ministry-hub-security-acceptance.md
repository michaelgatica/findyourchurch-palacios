# Community Ministry Hub Security And Risk Acceptance

Certification date: July 14, 2026

This record separates verified controls from risks that still require an owner decision. It is not production approval. No production Firebase project, data, rules, hosting, secrets, scheduler, email provider, or DNS setting was changed during certification.

## Current Decision

**NO-GO for production deployment today.** The deployed staging controls and automated isolation evidence are strong, but the launch owner has not accepted the remaining dependency risk, provider-backed email has not been certified, production App Check/monitoring/backup decisions are incomplete, and native screen-reader evidence remains unavailable. The available WebKit equivalent now passes; native Safari hardware remains a non-blocking environment limitation unless the launch owner requires device-specific proof.

The Community Ministry Hub changes may be prepared for review and merge, but deployment must remain gated on the blocking acceptance items at the end of this document.

## Production Dependency Audit

Command run on July 14, 2026:

```text
npm audit --omit=dev --json
```

Result: 298 production dependencies; 11 moderate advisory nodes; 0 high; 0 critical. The 11 nodes reduce to two upstream vulnerabilities: PostCSS CSS-stringification XSS and UUID buffer-bound handling in UUID v3/v5/v6 when a caller supplies a buffer. Installed versions were already the newest compatible releases on the supported Next 15, Firebase Admin 13, Google Cloud transport, and ExcelJS 4 lines. There was no supported nonbreaking fix to apply. `npm audit fix --force` was not run.

Risk owner for every pending row is the platform technical owner, with explicit acceptance also required from the launch owner. The target date is August 14, 2026 or before production deployment, whichever comes first.

| Package | Direct or transitive | Dependency path | Severity | Vulnerability and affected code path | Public exposure | Available fix and breaking impact | Compensating controls | Launch decision | Owner / target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `next@15.5.20` | Direct | application -> `next` -> `postcss` | Moderate | Inherits PostCSS unescaped `</style>` CSS-stringification XSS. Next renders the public application and processes application-owned CSS. | Public Next runtime; no user-authored CSS or CSS template surface exists. | npm proposes an unsafe `next@9.3.3` downgrade; Next 16 is a major framework migration. No compatible Next 15 fix is published. | Static application CSS, no user CSS authoring, input validation, staging CSP review queued. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `postcss@8.4.31` | Transitive | application -> `next@15.5.20` -> `postcss@8.4.31` | Moderate | GHSA-qx2v-qp2m-jg93: XSS through unescaped `</style>` in CSS stringify output. | Processing is internal to Next; registrants and representatives cannot submit CSS. | Fixed in PostCSS 8.5.10, but Next 15 pins 8.4.31 exactly. An override is not a supported Next configuration and was not applied. | Same as the Next row; do not add user-controlled CSS generation. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `firebase-admin@13.10.0` | Direct | application -> `firebase-admin` -> Firestore/Storage transports | Moderate | Inherits UUID and request-transport advisories from optional server SDK dependencies. Firebase Admin is used for Firestore, Auth, and Storage server operations. | Server-only; no Admin credentials or APIs are shipped to the browser. | npm identifies `firebase-admin@14.1.0`, a semver-major upgrade requiring a dedicated compatibility pass. Version 13.10.0 is the newest 13.x release. | Server-only imports, managed App Hosting service account, staging/project guards, rules tests, church-scoped service authorization. | Pending acceptance; blocks production until accepted or Firebase Admin 14 is validated. | Platform technical owner + launch owner / 2026-08-14 |
| `@google-cloud/firestore@7.11.6` | Transitive/optional | application -> `firebase-admin@13.10.0` -> `@google-cloud/firestore` -> `google-gax` | Moderate | Inherits Google transport UUID/request advisories. Used for server-side Firestore access. | Server-only. | Requires the Firebase Admin 14 major line; 7.11.6 is the newest compatible 7.x release. | Service authorization, bounded queries, staging emulator/rules tests, no client Admin SDK. | Pending acceptance; blocks production until accepted or safely upgraded. | Platform technical owner + launch owner / 2026-08-14 |
| `@google-cloud/storage@7.21.0` | Transitive/optional | application -> `firebase-admin@13.10.0` -> `@google-cloud/storage` -> `gaxios` / `retry-request` / `teeny-request` | Moderate | Inherits UUID-related request-transport advisories. Used for trusted flyer and private export Storage operations. | Server-only trusted upload/export path. | Requires the Firebase Admin 14 major line; current compatible transport versions are already installed. | Browser writes denied, upload type/size/dimension checks, church ownership enforcement, private export paths. | Pending acceptance; blocks production until accepted or safely upgraded. | Platform technical owner + launch owner / 2026-08-14 |
| `google-gax@4.6.1` | Transitive | application -> Firebase Admin -> Firestore -> `google-gax` -> `uuid@9.0.1` / `retry-request@7.0.2` | Moderate | Inherits UUID buffer-bound and request-transport advisories. Used inside Firestore RPC transport. | Server-only. | No fixed compatible 4.x release; upgrade arrives through the Firebase Admin 14 dependency tree. | No public buffer API, server-only RPC, bounded application queries. | Pending acceptance; blocks production until accepted or safely upgraded. | Platform technical owner + launch owner / 2026-08-14 |
| `gaxios@6.7.1` | Transitive | application -> Firebase Admin -> Cloud Storage/auth transport -> `gaxios` -> `uuid@9.0.1` | Moderate | Inherits UUID advisory. Used for server-side Google HTTP transport. | Server-only. | 6.7.1 is the last 6.x release; fixed UUID requires an upstream major-compatible transport update. | No application call supplies UUID output buffers; service account remains server-side. | Pending acceptance; blocks production until accepted or safely upgraded. | Platform technical owner + launch owner / 2026-08-14 |
| `retry-request@7.0.2` | Transitive | application -> Firebase Admin -> Cloud Storage / `google-gax` -> `retry-request` -> `teeny-request` | Moderate | Inherits the UUID advisory through the legacy request transport. | Server-only. | 7.0.2 is the last 7.x release; 8.x is an upstream major dependency change. | Trusted server paths, bounded retries controlled by upstream library, no public transport API. | Pending acceptance; blocks production until accepted or safely upgraded. | Platform technical owner + launch owner / 2026-08-14 |
| `teeny-request@9.0.0` | Transitive | application -> Firebase Admin -> Cloud Storage / `retry-request` -> `teeny-request` -> `uuid@9.0.1` | Moderate | Inherits UUID advisory. Used by the server-side Google request stack. | Server-only. | 9.0.0 is the last 9.x release; 10.x is an upstream major dependency change. | Same server-only controls; no caller-supplied UUID buffer. | Pending acceptance; blocks production until accepted or safely upgraded. | Platform technical owner + launch owner / 2026-08-14 |
| `exceljs@4.4.0` | Direct | application -> `exceljs` -> `uuid@8.3.2` | Moderate | Inherits UUID buffer-bound advisory. ExcelJS is used for authorized XLSX exports. | Authenticated church-scoped export route; not a public UUID API. | npm proposes the older `exceljs@3.4.0`; no fixed newer ExcelJS release is available. The downgrade is unsupported for this application. | Church-scoped authorization, private Storage, 24-hour expiry, 1,000-registration cap, 10 MB cap, formula-injection escaping. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |
| `uuid@8.3.2` and three `uuid@9.0.1` copies | Transitive | ExcelJS; `gaxios`; `google-gax`; `teeny-request` | Moderate | GHSA-w5hq-g745-h8pq: missing buffer bounds check in UUID v3/v5/v6 when `buf` is supplied. | No application route accepts or forwards a UUID output buffer. Application-owned identifiers use Node `crypto.randomUUID`; transitive callers use their internal ID paths. | Fixed at UUID 11.1.1, outside the parent packages' declared major ranges. Direct overrides were not applied. | Do not expose transitive UUID APIs; keep export and Admin SDK paths authenticated and server-only. | Pending acceptance; blocks production until accepted or safely remediated. | Platform technical owner + launch owner / 2026-08-14 |

## Security Control Acceptance Matrix

| Control | Evidence actually run or inspected | Result | Residual risk / launch impact |
| --- | --- | --- | --- |
| Public registration reads | Firestore rules deny browser access to `eventRegistrations`; emulator rules and registration-emulator suites exercise anonymous access. | Pass | Production rules must be deployed only after backup and index readiness. |
| Public registration list | Rules allow registration records only to admins and deny untrusted writes; public route reads a sanitized confirmation lookup only. | Pass | Re-run deployed rules tests after production rules deployment. |
| Cross-church registration access | Service authorization requires matching event/church representative access; emulator, hosted Church A/Church B, and live staging tests passed. | Pass | Production role assignments need a controlled smoke test. |
| Cross-church event administration | Trusted server services enforce church/event ownership; Church A could not open Church B event administration; limited event manager could not access platform admin. | Pass | Production representative fixtures must be controlled and removed after smoke. |
| Cross-church Storage access | Browser writes are denied; trusted server upload checks church/event ownership. Storage emulator and live staging isolation tests passed. | Pass | Production bucket identity must be rechecked before rules deployment. |
| Private exports | `private/event-exports/{churchId}/{eventId}` denies all browser access; download route checks authenticated church scope and expiry. | Pass | Production signing secret must be unique and stored in Secret Manager. |
| Export expiry | Export records expire after 24 hours; expired download is denied and cleanup deletes bounded expired records. Report and hosted scheduler suites passed. | Pass | Configure the production cleanup schedule and alert on failures. |
| Management tokens | Raw tokens are returned only to intended flows; Firestore stores a secret hash as the document ID; expired/revoked tokens fail; normal tokens expire after 180 days. | Pass | Rotating `REGISTRATION_TOKEN_SECRET` revokes existing links; launch communications must account for that. |
| Unlisted enumeration | Public list queries require `published + public + wasPublished`; rules deny list queries for unlisted events while allowing a known direct document link. Rules, hosted smoke, and SEO/sitemap tests passed. | Pass | Re-run after production index/rules deploy. |
| Never-published cancelled drafts | Direct public access requires `wasPublished`; cancelled unpublished fixture is denied. Firestore rules test passed. | Pass | None beyond post-deploy rules verification. |
| Scheduler authentication | Endpoint requires `REGISTRATION_JOBS_CRON_SECRET` and environment guard; unauthorized hosted request denied and authorized scheduler certification passed. | Pass | Production scheduler secret and job must be created together; never reuse staging. |
| Email idempotency | Scheduled jobs use deterministic idempotency keys and `deliveryCompletedAt`; hosted duplicate execution produced zero duplicate email-log entries. | Pass for application behavior | Provider-backed delivery, bounce handling, and provider message IDs remain untested and block production. |
| Sensitive log exclusion | Email console output omits bodies and addresses except recipient domain; email error redaction removes credentials; registration answer values are omitted from audit notes; scheduler metadata is counts/status only. Source audit and staging email redaction test passed. | Pass with gaps | Authorization-denial and rate-limit telemetry is incomplete; log sink controls and retention remain production prerequisites. |
| App Check | `APP_CHECK_SITE_KEY` is inventoried, but enforcement is not active in staging or production. | Deferred | Launch owner must approve monitor-first rollout or require enforcement before opening public registration. |
| Rate limiting and bot controls | Registration honeypot is active; per-event/request-identity limit is 8 submissions per 15 minutes; duplicate/idempotency records are transactionally enforced. Public event reports also use a honeypot and hashed request metadata. | Pass at application layer | App Check/WAF-level abuse controls are not active; high-volume abuse remains residual risk. |
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
| 11 moderate production advisory nodes | Pending acceptance | Server-only exposure limits, no user CSS, no caller-supplied UUID buffers, authenticated private exports | Platform technical owner + launch owner | 2026-08-14 / before deploy | Blocking until explicitly accepted or remediated |
| Provider-backed SMTP not certified | Deferred but blocking | Template/render suite, single-recipient staging guard, console provider | Ministry operations owner | Before deploy | Blocking |
| App Check not enforced | Pending decision | Server authorization, rules, honeypot, rate limit, idempotency | Platform technical owner | Before public registration opens | Blocking until owner records enforcement/monitor-first decision |
| External alerts not configured | Deferred but blocking | `/admin/ops`, operational/audit/email logs, manual scheduler inspection | Operations owner | Before public registration opens | Blocking |
| Authorization/rate-limit operational telemetry incomplete | Deferred | Enforcement still fails closed; infrastructure logs available | Platform technical owner | Within 30 days of launch, with launch-owner acceptance | Conditional blocker |
| Native screen-reader evidence unavailable | Pending external test | Axe and keyboard/semantic tests have zero critical/serious findings | Accessibility/launch owner | Before deploy | Blocking for full GO |
| Native Safari hardware unavailable | Documented limitation | Chromium, Edge, Firefox, and Playwright WebKit hosted suites passed | QA/launch owner | Post-launch device matrix unless owner elevates | Not blocking by default |
| Audit/email/job/log retention policy absent | Pending policy | Registration/export/token cleanup is bounded and certified | Privacy owner + operations owner | Before deploy | Blocking |
| Async export queue not implemented beyond 1,000 records | Accepted design limit pending owner sign-off | Hard 1,000-registration and 10 MB caps; tested 500-record exports | Platform technical owner | Before expansion beyond local launch | Not blocking at Palacios scale if accepted |

## Blocking Acceptance Checklist

- [ ] Launch owner accepts or remediates all 11 moderate dependency advisory nodes.
- [ ] Ministry operations certifies one provider-backed registration confirmation, administrator notification, and attached report to approved staging recipients.
- [ ] Accessibility/QA owner completes native screen-reader checks or signs an explicit residual-risk acceptance.
- [ ] Platform/launch owner records the App Check enforcement or monitor-first decision.
- [ ] Operations owner configures production alert destinations, escalation, and on-call response ownership.
- [ ] Privacy/operations owners approve retention for audit logs, email logs, scheduler records, and operational logs.
- [ ] Production backup and Storage-protection settings are confirmed before any production write.
- [ ] All production identifiers, secrets, rules, indexes, SMTP/DNS, scheduler, and canonical-domain checks pass in the deployment window.

Until every blocking box is resolved, the production recommendation remains **NO-GO**.
