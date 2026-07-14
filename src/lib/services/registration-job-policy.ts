import type { RegistrationScheduledJobRecord } from "@/lib/types/registrations";

export const registrationJobMaximumAttempts = 3;
export const registrationJobLeaseDurationMs = 10 * 60 * 1000;
export const registrationJobRunLeaseDurationMs = 20 * 60 * 1000;

export function getRegistrationJobRetryDelayMs(attempts: number) {
  const normalizedAttempts = Math.max(1, Math.floor(attempts));
  return Math.min(15 * 60 * 1000, 60 * 1000 * (2 ** (normalizedAttempts - 1)));
}

export function isRegistrationJobLeaseExpired(
  job: Pick<RegistrationScheduledJobRecord, "leaseExpiresAt">,
  now = Date.now(),
) {
  if (!job.leaseExpiresAt) return true;
  const expiresAt = Date.parse(job.leaseExpiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function canClaimRegistrationJob(
  job: Pick<RegistrationScheduledJobRecord, "status" | "scheduledFor" | "leaseExpiresAt">,
  now = Date.now(),
) {
  if (job.status === "processing") return isRegistrationJobLeaseExpired(job, now);
  return job.status === "pending" && Date.parse(job.scheduledFor) <= now;
}
