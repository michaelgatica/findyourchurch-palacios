import assert from "node:assert/strict";

import {
  buildAbsoluteUrl,
  createPageMetadata,
  getSiteUrl,
} from "../src/lib/config/site";
import {
  buildEventCalendarFile,
  buildEventStructuredData,
  buildGoogleCalendarUrl,
  filterEvents,
} from "../src/lib/event-utils";
import { communityHubLimits } from "../src/lib/community-hub-limits";
import { emptyEventFilters, type EventRecord } from "../src/lib/types/events";

process.env.APP_ENV = "staging";
process.env.NEXT_PUBLIC_APP_ENV = "staging";
process.env.NEXT_PUBLIC_SITE_URL =
  "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";

const event = {
  id: "seo-calendar-event",
  churchId: "church-a",
  churchName: "Fictitious Test Church",
  churchSlug: "fictitious-test-church",
  churchRoutePath: "/tx/palacios/fictitious-test-church",
  title: "Fictitious Calendar, Sharing; Test",
  slug: "fictitious-calendar-sharing-test",
  summary: "A fictitious event used for metadata tests.",
  description: "Line one.\nLine two, with punctuation; safely escaped.",
  primaryType: "community",
  audienceTags: ["families"],
  customTags: [],
  status: "cancelled",
  visibility: "public",
  isFeatured: false,
  flyerImage: {
    id: "flyer",
    src: "https://storage.googleapis.test/flyer.png",
    alt: "Fictitious event flyer",
    sortOrder: 1,
    width: 1200,
    height: 675,
  },
  additionalImages: [],
  startsAt: "2030-04-13T15:00:00.000Z",
  endsAt: "2030-04-13T17:00:00.000Z",
  allDay: false,
  timeZone: "America/Chicago",
  isRecurring: false,
  recurrenceExceptions: [],
  locationMode: "in_person",
  venueName: "Fictitious Hall",
  address: {
    line1: "123 Test Lane",
    city: "Palacios",
    stateCode: "TX",
    postalCode: "77465",
    countryCode: "US",
    latitude: null,
    longitude: null,
  },
  languages: ["English"],
  childcareProvided: false,
  mealProvided: false,
  costStatus: "free",
  registration: { mode: "none", waitlistEnabled: false },
  cancellationMessage: "Cancelled for a fictitious test.",
  publishedAt: "2030-01-01T00:00:00.000Z",
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-02T03:04:05.000Z",
  cancelledAt: "2030-01-02T03:04:05.000Z",
  wasPublished: true,
} as EventRecord;

assert.equal(getSiteUrl().includes("findyourchurch-staging-2026"), true);
assert.equal(
  buildAbsoluteUrl("https://storage.googleapis.test/flyer.png"),
  "https://storage.googleapis.test/flyer.png",
  "Absolute Storage URLs must not be prefixed with the site host.",
);

const structuredData = buildEventStructuredData(event);
assert.deepEqual(structuredData.image, ["https://storage.googleapis.test/flyer.png"]);
assert.equal(structuredData.eventStatus, "https://schema.org/EventCancelled");
assert.equal(structuredData.url, `${getSiteUrl()}/events/${event.slug}`);

const googleCalendarUrl = new URL(buildGoogleCalendarUrl(event));
assert.equal(googleCalendarUrl.hostname, "calendar.google.com");
assert.equal(googleCalendarUrl.searchParams.get("dates"), "20300413T150000Z/20300413T170000Z");
assert.match(googleCalendarUrl.searchParams.get("details") ?? "", /CANCELLED/);
assert.match(googleCalendarUrl.searchParams.get("details") ?? "", new RegExp(`${getSiteUrl()}/events/${event.slug}`));
assert.match(googleCalendarUrl.searchParams.get("location") ?? "", /123 Test Lane/);

const calendarFile = buildEventCalendarFile(event);
assert.match(calendarFile, /DTSTART:20300413T150000Z/);
assert.match(calendarFile, /DTEND:20300413T170000Z/);
assert.match(calendarFile, /X-WR-TIMEZONE:America\/Chicago/);
assert.match(calendarFile, /STATUS:CANCELLED/);
assert.match(calendarFile, /LOCATION:123 Test Lane\\, Palacios\\, TX 77465/);
assert.match(calendarFile, new RegExp(`URL:${getSiteUrl()}/events/${event.slug}`));
assert.equal(calendarFile.includes("\n") && calendarFile.includes("\r\n"), true);

const metadata = createPageMetadata({
  title: "Fictitious event",
  description: "Fictitious description",
  pathname: `/events/${event.slug}`,
  imagePath: event.flyerImage?.src,
  imageWidth: event.flyerImage?.width ?? undefined,
  imageHeight: event.flyerImage?.height ?? undefined,
  imageAlt: event.flyerImage?.alt,
});
assert.deepEqual(metadata.robots, { index: false, follow: false });
assert.equal(metadata.alternates?.canonical, `/events/${event.slug}`);
assert.equal((metadata.openGraph as { url?: string }).url, `${getSiteUrl()}/events/${event.slug}`);

const filtered = filterEvents(
  [event],
  { ...emptyEventFilters, startsOnOrAfter: "2030-04-13", startsOnOrBefore: "2030-04-13" },
);
assert.equal(filtered.length, 1);
assert.equal(
  filterEvents([event], { ...emptyEventFilters, startsOnOrAfter: "2030-04-14" }).length,
  0,
);

assert.equal(communityHubLimits.registrationsPerExport, 1_000);
assert.equal(communityHubLimits.participantsPerRegistration, 25);
assert.equal(communityHubLimits.generatedExportBytes, 10 * 1024 * 1024);
assert.equal(communityHubLimits.schedulerBatchSize, 25);

console.log(
  JSON.stringify(
    {
      ok: true,
      suite: "community-hub-performance-seo",
      checks: [
        "staging-safe canonical host",
        "absolute flyer URL preservation",
        "structured Event cancellation metadata",
        "Google Calendar timing, location, public URL, and cancellation state",
        "ICS timing, timezone, venue, URL, escaping, and cancellation state",
        "staging noindex metadata",
        "inclusive date filtering",
        "documented operating limits",
      ],
    },
    null,
    2,
  ),
);
