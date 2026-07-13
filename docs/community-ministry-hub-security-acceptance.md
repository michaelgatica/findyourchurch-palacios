# Community Ministry Hub Security Acceptance

This document records launch risks that are accepted, deferred, or blocking for Community Ministry Hub.

## Dependency Advisory Table

`npm audit --omit=dev --json` currently reports 11 moderate production advisories.

| Package | Direct | Path | Severity | Description | Used path | Public exposure | Available fix | Breaking impact | Decision | Compensating controls | Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `next` / `postcss` | Next direct, PostCSS transitive | `next -> postcss` | Moderate | PostCSS CSS stringify XSS for unescaped `</style>` | Next build/runtime CSS handling | Public web app uses Next, but app does not expose arbitrary user CSS authoring | npm suggests `next@9.3.3` via force | Unsafe downgrade/major behavior change | Accept for initial staging; monitor upstream patch | No user-supplied CSS, server validation, CSP should be considered post-launch | Re-run before production launch |
| `exceljs` / `uuid` | ExcelJS direct, uuid transitive | `exceljs -> uuid` | Moderate | uuid missing buffer bounds check for v3/v5/v6 when `buf` provided | XLSX export generation | Authenticated representative export path; no public uuid buffer API exposed | npm suggests `exceljs@3.4.0` via force | Unsafe downgrade | Accept with export authorization controls | Auth required, cross-church isolation, formula injection protection, private Storage exports | Revisit next safe ExcelJS release |
| `firebase-admin` / Google Cloud / `uuid` | Firebase Admin direct, transitive Google Cloud packages | `firebase-admin -> @google-cloud/* -> uuid` | Moderate | uuid transitive advisory | Firestore/Storage Admin SDK calls | Server-side only; no direct public uuid API | npm suggests `firebase-admin@10.3.0` via force | Major downgrade from current SDK | Accept with server-side controls | Admin SDK server-only, no client credentials, rules tests, least-privilege service account recommended | Track Firebase Admin/Google Cloud updates |
| `gaxios`, `google-gax`, `retry-request`, `teeny-request` | Transitive | Google Cloud transport dependencies | Moderate | uuid-related transport dependency paths | Server-side Firebase Admin transport | Server-side only | Transitive update only through upstream packages | Not safely actionable directly | Accept | No secret logging, no public transport access | Track upstream |

## Accepted Risks

| Risk | Owner | Compensating controls | Blocks launch? | Target remediation |
| --- | --- | --- | --- | --- |
| 11 moderate dependency advisories remain without safe nonbreaking npm fix | Technical owner | Avoid `npm audit fix --force`, monitor upstream, do not expose user CSS, restrict exports to authorized users | No, if launch owner accepts | Re-run audit before production launch and monthly after |
| App Check not enforced yet | Technical owner | Auth, server authorization, Firestore/Storage rules, cron secrets, honeypot/report validation | No for controlled launch; yes for high-abuse national rollout | Decide/enforce after staging traffic test |
| Manual accessibility QA not completed | Launch owner | Automated build/rules pass, manual checklist prepared | Yes for full GO | Complete in staging before launch |
| Live SMTP not verified in staging | Ministry operations owner | Console email in dev, templates tested locally | Yes for full GO | Configure staging-safe provider and test |
| Scheduler not verified in staging | Technical owner | Protected endpoint and local scheduler tests | Yes for full GO | Configure staging scheduler and run duplicate/idempotency checks |
| Staging browser QA not completed | Launch owner | Emulator tests and docs | Yes for full GO | Complete QA matrix |

## Deferred Risks

| Risk | Owner | Reason deferred | Blocks launch? | Target |
| --- | --- | --- | --- | --- |
| Async export jobs for very large events | Technical owner | Current expected launch scale is small; exports are authorized and documented | No for Palacios-scale launch | Before statewide/national rollout |
| External monitoring provider not configured | Technical owner | `/admin/ops` and operational logs exist, but no external alerting credentials provided | Conditional | Before public event registration is broadly promoted |
| Full App Check enforcement | Technical owner | Requires staging provider and rollout test | Conditional | After staging validation |

## Non-Negotiable Blocking Items For Full GO

- Dedicated staging or preview environment verified.
- Live SMTP test completed.
- Scheduler authentication and idempotency verified.
- Manual accessibility critical/high issues resolved.
- Cross-church isolation verified in deployed staging.
- Export generation/download verified through deployed staging.
- Launch owner explicitly accepts remaining dependency advisories.
