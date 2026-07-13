# Community Ministry Hub Accessibility Review

This document tracks accessibility expectations, current automated coverage, and the manual review still required before full production GO.

## Current Status

- Critical findings: none identified by automated/local code review in this phase.
- High findings: not fully determinable without browser/manual QA.
- Automated axe/browser testing: not configured in this repository during this phase.
- Manual accessibility QA: blocked until a staging or preview environment with seeded data is available.

A full GO requires manual review of the signed-in portal and admin flows.

## Required Manual Checks

| Surface | Keyboard | Focus | Labels/errors | Screen reader | Color/zoom/reflow | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Homepage events section | Required | Required | N/A | Required | Required | Blocked: no staging URL |
| `/events` calendar/list | Required | Required | Required | Required | Required | Blocked: no staging URL |
| Event cards/detail | Required | Required | Required | Required | Required | Blocked: no staging URL |
| Event report form | Required | Required | Required | Required | Required | Blocked: no staging URL |
| Registration form | Required | Required | Required | Required | Required | Blocked: no staging URL |
| Conditional registration fields | Required | Required | Required | Required | Required | Blocked: no staging URL |
| Confirmation page | Required | Required | N/A | Required | Required | Blocked: no staging URL |
| Management link page | Required | Required | Required | Required | Required | Blocked: no staging URL |
| Portal event dashboard | Required | Required | Required | Required | Required | Blocked: no staging auth |
| Event editor | Required | Required | Required | Required | Required | Blocked: no staging auth |
| Form builder | Required | Required | Required | Required | Required | Blocked: no staging auth |
| Registration list/detail | Required | Required | Required | Required | Required | Blocked: no staging auth |
| Check-in mode | Required | Required | Required | Required | Required | Blocked: no staging auth |
| Export dialogs | Required | Required | Required | Required | Required | Blocked: no staging auth |
| Platform events admin | Required | Required | Required | Required | Required | Blocked: no staging admin |
| Event reports admin | Required | Required | Required | Required | Required | Blocked: no staging admin |
| Category admin | Required | Required | Required | Required | Required | Blocked: no staging admin |
| Ops page | Required | Required | N/A | Required | Required | Blocked: no staging admin |

## Manual Procedure

For each surface:

1. Navigate using keyboard only.
2. Confirm focus order follows visual order.
3. Confirm visible focus is always present.
4. Confirm forms have labels, required indicators, field errors, and error summaries.
5. Confirm dynamic updates are announced or visible without relying on color only.
6. Confirm tables have headings or mobile card alternatives.
7. Test 200 percent zoom and narrow reflow.
8. Confirm touch targets are comfortable on mobile.
9. Confirm flyer images have useful alt text or decorative fallback behavior.
10. Record severity: Critical, High, Medium, Low.

## Severity Definitions

- Critical: prevents completion of registration, event management, admin moderation, or security-sensitive action.
- High: causes serious confusion or blocks a common assistive technology path.
- Medium: degrades usability but has a reasonable workaround.
- Low: polish issue or documentation improvement.

## Current Recommendation

Accessibility remains a full-GO blocker until manual browser review is completed in staging. If no critical/high issues are found, medium/low issues may be accepted with owners and remediation dates.
