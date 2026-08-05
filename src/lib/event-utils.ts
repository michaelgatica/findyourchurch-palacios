import { buildAbsoluteUrl } from "@/lib/config/site";
import { formatAddress } from "@/lib/church-utils";
import type { EventFilters, EventRecord } from "@/lib/types/events";

export const DEFAULT_EVENT_TIMEZONE = "America/Chicago";

export function formatEventDateRange(event: EventRecord) {
  const targetTimeZone = event.timeZone || DEFAULT_EVENT_TIMEZONE;

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: targetTimeZone,
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: targetTimeZone,
  });
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;

  if (event.allDay) {
    return endsAt
      ? `${dateFormatter.format(startsAt)} - ${dateFormatter.format(endsAt)}`
      : dateFormatter.format(startsAt);
  }

  return endsAt
    ? `${dateFormatter.format(startsAt)}, ${timeFormatter.format(startsAt)} - ${timeFormatter.format(endsAt)}`
    : `${dateFormatter.format(startsAt)}, ${timeFormatter.format(startsAt)}`;
}

export function buildEventPath(event: EventRecord | string) {
  return `/events/${typeof event === "string" ? event : event.slug}`;
}

export function buildGoogleCalendarUrl(event: EventRecord) {
  const formatCalendarDate = (value: string) =>
    new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = formatCalendarDate(event.startsAt);
  const end = formatCalendarDate(event.endsAt ?? event.startsAt);
  const details = [event.description, event.informationUrl].filter(Boolean).join("\n\n");
  const location = event.address
    ? formatAddress(event.address)
    : event.onlineUrl ?? event.venueName ?? "";

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    event.title,
  )}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
    location,
  )}`;
}

export function buildEventStructuredData(event: EventRecord) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary || event.description,
    startDate: event.startsAt,
    endDate: event.endsAt ?? undefined,
    eventStatus:
      event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode:
      event.locationMode === "online"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : event.locationMode === "hybrid"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    image: event.flyerImage?.src ? [buildAbsoluteUrl(event.flyerImage.src)] : undefined,
    location: event.address
      ? {
          "@type": "Place",
          name: event.venueName ?? event.churchName,
          address: {
            "@type": "PostalAddress",
            streetAddress: event.address.line1,
            addressLocality: event.address.city,
            addressRegion: event.address.stateCode,
            postalCode: event.address.postalCode,
            addressCountry: event.address.countryCode,
          },
        }
      : undefined,
    organizer: {
      "@type": "Organization",
      name: event.churchName,
      url: buildAbsoluteUrl(`/churches/${event.churchSlug}`),
    },
    url: buildAbsoluteUrl(buildEventPath(event)),
    isAccessibleForFree: event.costStatus !== "fee_required",
  };
}

function createSearchableEventText(event: EventRecord) {
  return [
    event.title,
    event.summary,
    event.description,
    event.churchName,
    event.primaryType,
    event.audienceTags.join(" "),
    event.customTags.join(" "),
    event.languages.join(" "),
    event.venueName,
    event.address?.city,
    event.hostMinistry,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterEvents(events: EventRecord[], filters: EventFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  return events.filter((event) => {
    if (keyword && !createSearchableEventText(event).includes(keyword)) {
      return false;
    }

    if (filters.churchId && event.churchId !== filters.churchId) {
      return false;
    }

    if (filters.city && event.address?.city !== filters.city) {
      return false;
    }

    if (filters.primaryType && event.primaryType !== filters.primaryType) {
      return false;
    }

    if (filters.audienceTag && !event.audienceTags.includes(filters.audienceTag)) {
      return false;
    }

    if (filters.language && !event.languages.includes(filters.language)) {
      return false;
    }

    if (filters.registrationMode && event.registration.mode !== filters.registrationMode) {
      return false;
    }

    if (filters.costStatus && event.costStatus !== filters.costStatus) {
      return false;
    }

    if (filters.locationMode && event.locationMode !== filters.locationMode) {
      return false;
    }

    if (filters.childcareProvided && !event.childcareProvided) {
      return false;
    }

    if (filters.wheelchairAccessible && !event.accessibilityDetails) {
      return false;
    }

    return true;
  });
}

export function getEventRegistrationStatusLabel(event: EventRecord) {
  if (event.status === "cancelled") {
    return "Cancelled";
  }

  if (event.registration.mode === "none") {
    return "No registration";
  }

  if (event.registration.closesAt && new Date(event.registration.closesAt) < new Date()) {
    return "Registration closed";
  }

  return event.registration.mode === "simple_rsvp"
    ? "RSVP open"
    : event.registration.mode === "internal_custom"
      ? "Registration open"
      : "External registration";
}

/**
 * Converts ISO UTC date strings to 'YYYY-MM-DDTHH:mm' in Central Time for <input type="datetime-local">.
 */
export function toCentralDateTimeInput(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_EVENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  let hour = getPart("hour");
  if (hour === "24") hour = "00";
  const minute = getPart("minute");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Converts 'YYYY-MM-DDTHH:mm' strings entered in Central Time to ISO UTC strings for saving.
 */
export function centralInputToISO(localInputString: string): string {
  if (!localInputString) return "";

  if (
    localInputString.includes("Z") ||
    localInputString.includes("+") ||
    (localInputString.includes("-") && localInputString.length > 19)
  ) {
    return new Date(localInputString).toISOString();
  }

  const [datePart, timePart] = localInputString.split("T");
  if (!datePart || !timePart) return new Date(localInputString).toISOString();

  const localIso = `${datePart}T${timePart}:00`;

  // Determine if the target date falls under Central Daylight Time (-05:00) or Central Standard Time (-06:00)
  const testDate = new Date(`${localIso}-05:00`);
  const isCDT = testDate
    .toLocaleString("en-US", { timeZone: DEFAULT_EVENT_TIMEZONE, timeZoneName: "short" })
    .includes("CDT");

  const offset = isCDT ? "-05:00" : "-06:00";

  return new Date(`${localIso}${offset}`).toISOString();
}
