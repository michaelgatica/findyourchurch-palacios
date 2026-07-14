import { timingSafeEqual } from "crypto";

export interface RegistrationJobRequestValidationInput {
  method: string;
  configuredSecret?: string | null;
  providedSecret?: string | null;
  configuredEnvironment: string;
  providedEnvironment?: string | null;
  contentLength?: string | null;
  transferEncoding?: string | null;
}

export type RegistrationJobRequestValidation =
  | { ok: true }
  | { ok: false; status: number; error: string };

function secretsMatch(configuredSecret: string, providedSecret: string) {
  const configured = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  if (configured.length !== provided.length) return false;
  return timingSafeEqual(configured, provided);
}

export function validateRegistrationJobRequest(
  input: RegistrationJobRequestValidationInput,
): RegistrationJobRequestValidation {
  if (input.method.toUpperCase() !== "POST") {
    return { ok: false, status: 405, error: "Method not allowed." };
  }

  const configuredSecret = input.configuredSecret?.trim();
  if (!configuredSecret) {
    return { ok: false, status: 503, error: "Registration scheduler authentication is not configured." };
  }

  const providedSecret = input.providedSecret?.trim();
  if (!providedSecret || !secretsMatch(configuredSecret, providedSecret)) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const configuredEnvironment = input.configuredEnvironment.trim().toLowerCase();
  const providedEnvironment = input.providedEnvironment?.trim().toLowerCase();
  if (!providedEnvironment || providedEnvironment !== configuredEnvironment) {
    return { ok: false, status: 400, error: "Scheduler environment marker is missing or invalid." };
  }

  if (input.transferEncoding?.trim()) {
    return { ok: false, status: 413, error: "Scheduler requests must not include a body." };
  }

  if (input.contentLength?.trim()) {
    const contentLength = Number(input.contentLength);
    if (!Number.isInteger(contentLength) || contentLength < 0) {
      return { ok: false, status: 400, error: "Invalid Content-Length header." };
    }
    if (contentLength > 0) {
      return { ok: false, status: 413, error: "Scheduler requests must not include a body." };
    }
  }

  return { ok: true };
}
