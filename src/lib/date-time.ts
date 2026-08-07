export const defaultEventTimeZone = "America/Chicago";

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dateTimePartFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimePartFormatter(timeZone: string) {
  const cachedFormatter = dateTimePartFormatterCache.get(timeZone);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });

  dateTimePartFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getZonedDateTimeParts(value: Date, timeZone: string): ZonedDateTimeParts {
  const parts = getDateTimePartFormatter(timeZone).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((valuePart) => valuePart.type === type)?.value ?? NaN);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function buildUtcCalendarMs(parts: Omit<ZonedDateTimeParts, "second"> & { second?: number }) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second ?? 0, 0);
  return date.getTime();
}

function getTimeZoneOffsetMs(timeZone: string, instantMs: number) {
  const parts = getZonedDateTimeParts(new Date(instantMs), timeZone);
  return buildUtcCalendarMs(parts) - instantMs;
}

function parseWallTime(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue);

  if (!dateMatch || !timeMatch) {
    throw new Error("Choose a valid event date and time.");
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };
  const calendarMs = buildUtcCalendarMs(parts);
  const calendarDate = new Date(calendarMs);

  if (
    calendarDate.getUTCFullYear() !== parts.year ||
    calendarDate.getUTCMonth() !== parts.month - 1 ||
    calendarDate.getUTCDate() !== parts.day ||
    calendarDate.getUTCHours() !== parts.hour ||
    calendarDate.getUTCMinutes() !== parts.minute ||
    calendarDate.getUTCSeconds() !== parts.second ||
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    throw new Error("Choose a valid event date and time.");
  }

  return { parts, calendarMs };
}

/** Convert a wall-clock date/time in an IANA zone into an unambiguous UTC ISO string. */
export function zonedWallTimeToUtcIso(
  dateValue: string,
  timeValue: string,
  timeZone = defaultEventTimeZone,
) {
  const { parts, calendarMs } = parseWallTime(dateValue, timeValue);

  let candidateMs = calendarMs;
  const seenCandidates = new Set<number>();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nextCandidateMs = calendarMs - getTimeZoneOffsetMs(timeZone, candidateMs);

    if (nextCandidateMs === candidateMs) {
      break;
    }

    if (seenCandidates.has(nextCandidateMs)) {
      break;
    }

    seenCandidates.add(candidateMs);
    candidateMs = nextCandidateMs;
  }

  const roundTrip = getZonedDateTimeParts(new Date(candidateMs), timeZone);
  const matchesWallTime =
    roundTrip.year === parts.year &&
    roundTrip.month === parts.month &&
    roundTrip.day === parts.day &&
    roundTrip.hour === parts.hour &&
    roundTrip.minute === parts.minute &&
    roundTrip.second === parts.second;

  if (!matchesWallTime) {
    throw new Error(`The selected date and time does not exist in ${timeZone}.`);
  }

  return new Date(candidateMs).toISOString();
}

function parseInstant(value: string | Date) {
  const instant = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return instant;
}

export function formatZonedDateInputValue(
  value?: string | Date | null,
  timeZone = defaultEventTimeZone,
) {
  const instant = value ? parseInstant(value) : null;

  if (!instant) {
    return "";
  }

  const parts = getZonedDateTimeParts(instant, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatZonedTimeInputValue(
  value?: string | Date | null,
  timeZone = defaultEventTimeZone,
) {
  const instant = value ? parseInstant(value) : null;

  if (!instant) {
    return "";
  }

  const parts = getZonedDateTimeParts(instant, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatZonedDateTimeInputValue(
  value?: string | Date | null,
  timeZone = defaultEventTimeZone,
) {
  const dateValue = formatZonedDateInputValue(value, timeZone);
  const timeValue = formatZonedTimeInputValue(value, timeZone);
  return dateValue && timeValue ? `${dateValue}T${timeValue}` : "";
}

export function formatDateInputValueDaysFromNow(
  days: number,
  timeZone = defaultEventTimeZone,
) {
  const now = getZonedDateTimeParts(new Date(), timeZone);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(now.year, now.month - 1, now.day + days);
  calendarDate.setUTCHours(0, 0, 0, 0);
  return formatZonedDateInputValue(calendarDate, "UTC");
}

export function zonedDateTimeLocalToUtcIso(
  value: string,
  timeZone = defaultEventTimeZone,
) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/.exec(value);

  if (!match) {
    throw new Error("Choose a valid registration date and time.");
  }

  return zonedWallTimeToUtcIso(match[1], match[2], timeZone);
}

/**
 * Reinterpret an ISO timestamp's UTC clock fields as a wall-clock time in an
 * IANA zone. This is intentionally separate from normal display formatting;
 * it is for repairing records written by the old server-local conversion.
 */
export function reinterpretUtcIsoAsZonedWallTime(
  value: string,
  timeZone = defaultEventTimeZone,
) {
  const instant = parseInstant(value);

  if (!instant) {
    throw new Error("The stored event timestamp is invalid.");
  }

  const dateValue = instant.toISOString().slice(0, 10);
  const timeValue = instant.toISOString().slice(11, 19);
  return zonedWallTimeToUtcIso(dateValue, timeValue, timeZone);
}
