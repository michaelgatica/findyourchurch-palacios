export type ExternalRegistrationKind = "google_forms" | "external";

const googleFormsHosts = new Set([
  "docs.google.com",
  "forms.google.com",
  "forms.gle",
]);

export function validateExternalRegistrationUrl(
  value: string | null | undefined,
  kind: ExternalRegistrationKind,
) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error("Add the secure external registration URL.");
  }

  let url: URL;
  try {
    url = new URL(normalizedValue);
  } catch {
    throw new Error("Enter a valid external registration URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Use a secure HTTPS registration URL.");
  }
  if (url.username || url.password) {
    throw new Error("External registration URLs cannot contain embedded credentials.");
  }

  const hostName = url.hostname.toLowerCase();
  if (kind === "google_forms" && !googleFormsHosts.has(hostName)) {
    throw new Error("Use a Google Forms URL hosted by Google Forms.");
  }

  return url.toString();
}

export function getExternalRegistrationDestination(value: string) {
  return new URL(value).hostname.toLowerCase();
}
