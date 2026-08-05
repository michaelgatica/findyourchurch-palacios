export const CENTRAL_TIMEZONE = "America/Chicago";

/**
 * Formats a date string or Date object into a readable date string in Central Time (e.g., "Aug 10, 2026").
 */
export function formatDate(
  dateInput: Date | string | number | null | undefined,
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: CENTRAL_TIMEZONE,
  });
}

/**
 * Formats a date string or Date object into a date and time string in Central Time (e.g., "Aug 10, 2026, 6:00 PM").
 */
export function formatDateTime(
  dateInput: Date | string | number | null | undefined,
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: CENTRAL_TIMEZONE,
  });
}

/**
 * Formats string arrays or list values into a comma-separated string.
 */
export function formatListValue(value: unknown): string {
  if (!value) return "None";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }
  if (typeof value === "string") {
    return value.trim() ? value : "None";
  }
  return String(value);
}

/**
 * Formats boolean flags into "Yes" / "No" or custom labels.
 */
export function formatBooleanLabel(
  value: unknown,
  trueLabel = "Yes",
  falseLabel = "No",
): string {
  return Boolean(value) ? trueLabel : falseLabel;
}

/**
 * Formats time in Central Time (e.g., "6:00 PM").
 */
export function formatEventTime(
  dateInput: Date | string | number | null | undefined,
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: CENTRAL_TIMEZONE,
  });
}

/**
 * Formats date in Central Time (e.g., "Sun, Aug 10, 2026").
 */
export function formatEventDate(
  dateInput: Date | string | number | null | undefined,
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: CENTRAL_TIMEZONE,
  });
}

/**
 * Formats full Date & Time in Central Time with CT indicator (e.g., "Aug 10, 2026, 6:00 PM CT").
 */
export function formatEventDateTime(
  dateInput: Date | string | number | null | undefined,
): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  return (
    date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: CENTRAL_TIMEZONE,
    }) + " CT"
  );
}
