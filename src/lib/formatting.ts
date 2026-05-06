const centralTimeZone = "America/Chicago";

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not yet available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: centralTimeZone,
  }).format(new Date(value));
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not yet available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: centralTimeZone,
  }).format(new Date(value));
}

export function formatListValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Not listed";
}

export function formatBooleanLabel(value: boolean) {
  return value ? "Yes" : "No";
}
