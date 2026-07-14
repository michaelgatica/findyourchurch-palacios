# Community Ministry Hub Accessibility Review

This document records the hosted staging accessibility, keyboard, responsive, and semantic review completed July 14, 2026. It is not production approval and does not include performance, SEO, dependency, or release certification.

## Environment And Coverage

- Firebase project: `findyourchurch-staging-2026`.
- Hosted staging URL: `https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app`.
- Tested engines: Playwright Chromium, installed Microsoft Edge, and Playwright Firefox.
- Standalone Google Chrome: **Not tested — browser unavailable in this environment.**
- WebKit/Safari equivalent: **Not tested — browser unavailable in this environment.**
- Viewports: 320x720, 375x812, 430x932, 768x1024, 1024x768, 1366x768, and 1920x1080.
- Reflow: registration form checked at 200 percent zoom from a 1024x768 viewport.
- Automated semantics: axe-core WCAG 2 A/AA, WCAG 2.1 A/AA, and WCAG 2.2 AA tags.
- Manual assistive-technology limitation: a native screen-reader application was not available. Keyboard behavior, accessible names, roles, states, landmarks, labels, errors, and live regions were inspected through the browser accessibility tree and DOM.

The committed runner loads the Firebase client key and QA password only into child-process memory from approved private staging configuration. It rejects any base URL other than the dedicated staging host.

## Automated Results

The hosted suite covers 21 fixed public, representative, and administrator routes plus the newly created registration-management state in each tested engine. Across Chromium, Edge, and Firefox, 66 axe scans completed with no critical or serious violations after corrections.

The scanned surfaces include the homepage, sign-in pages, directory, church profile, event listing, published and cancelled event detail, registration and confirmation, registration management, representative dashboard/editor/form builder/registration/check-in pages, and all four Community Hub administration areas.

## Findings

| Severity | Finding | Result |
| --- | --- | --- |
| Critical | No critical accessibility issue was found. | Pass |
| High | Admin event, report, and category filters/actions contained unnamed selects or inputs. | Fixed with explicit contextual accessible names. |
| High | Skip navigation changed the hash without moving focus to the main content target. | Fixed by making the single root main focusable. |
| High | The account menu lacked arrow-key navigation, Escape close, and focus return. | Fixed with menu semantics and deterministic keyboard behavior. |
| High | Nested main landmarks, ambiguous form-builder reorder controls, incomplete table headers, and non-announced portal status messages created semantic ambiguity. | Fixed with one main landmark, contextual names, column scopes, and status/alert live regions. |
| High | Firefox overflowed the 320px operations page because long readiness values and grid children could not shrink. | Fixed with shrink-safe grid/card rules and wrapping for headings, descriptions, badges, and code values. |
| High | Firefox completed the multipart event save on the server but did not follow Next's intercepted server-action redirect, leaving the user on the editor. | Fixed with a same-origin authenticated native POST endpoint that reuses existing validation/services and returns a public-origin `303`. |
| Medium | Cross-church and draft event denials use the generic heading “We couldn't find that church page.” Access fails closed, but the wording is not event-specific. | Remaining; content-only improvement with no data exposure. |
| Medium | Firefox/Next occasionally emits exact `Connection closed.` RSC page errors or React error 419 (a Suspense boundary falls back to client rendering) after a successful representative navigation. The requested state change, focus path, subsequent navigation, and downloads still complete. | Remaining framework/hosting issue; narrowly allowlisted by exact message only in the representative workflow and documented for future Next/App Hosting validation. |
| Low | No low-severity issue remains from the tested routes. | None open. |

All critical and high findings identified in this phase are resolved in the deployed staging revision.

## Keyboard And Focus Review

| Check | Result | Evidence |
| --- | --- | --- |
| Skip to content | Pass | First Tab exposes the skip link; Enter moves focus to `#main-content`. |
| Primary/mobile navigation | Pass | Menu button is focusable, exposes expanded state, and works at 320-430px. |
| Account dropdown | Pass | Enter/Arrow Down opens; Arrow Up/Down, Home, End, and Escape work; Escape returns focus. |
| Focus order and visibility | Pass | Public, portal, check-in, export, and admin controls follow document order and retain visible focus. |
| Calendar filters and date controls | Pass | Labeled native inputs/selects are keyboard operable in all tested engines. |
| Registration errors | Pass | Invalid submission focuses the first required field; repeating attendee groups and controls have contextual names. |
| Dynamic messages | Pass | Representative success/error output uses status/alert semantics. |
| Form-builder reorder | Pass | Move, duplicate, remove, and add controls include the field/section context in their names. |
| Check-in | Pass | Action can be focused and activated; the test toggles and restores a fictitious registration. |
| Tables/mobile cards | Pass | Registration table headers are explicit; 320px authenticated views do not overflow. |
| Dialog focus trap/return | Not applicable | The tested Community Hub routes do not currently render a native application dialog. The external donation integration is outside this staging flow. |

## Semantic Review

- A single root main landmark is present; header, primary navigation, representative navigation, aside, and footer landmarks are labeled or structurally clear.
- Route heading levels, visible form labels, required text, error associations, table headers, button/link names, status badges, cancellation notices, empty states, and loading/error output were inspected.
- Flyer images use event-specific alt text where displayed; fallback media does not expose a misleading interactive name.
- Check-in, registration, waitlist/cancellation, and operational states are conveyed in text rather than color alone.
- No blocking unnamed icon control or color-only workflow state remained in tested snapshots.

## Responsive Review

Chromium, Edge, and Firefox each passed no-horizontal-overflow checks for the homepage, event listing, event detail, and registration form at all seven target viewports. At 320px, representative registration, form builder, check-in, export, and administrator event/report/category/operations surfaces also passed. The registration form reflowed at 200 percent zoom without horizontal page overflow or loss of controls.

Visual evidence was captured outside the repository and contains no password or management token:

- `events-1366-chromium.png`: desktop community calendar and filters.
- `check-in-375-chromium.png`: authenticated mobile check-in layout with fictitious staging registrations.

## Current Recommendation

No critical or high accessibility/browser blocker remains in the tested hosted staging scope. The Community Ministry Hub is **ready for performance and SEO validation**. This is not production approval; native screen-reader coverage, WebKit/Safari coverage, the event-specific not-found wording, staging SMTP delivery, and final release certification remain separate work.
