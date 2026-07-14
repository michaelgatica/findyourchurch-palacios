export const operationalRecordRetentionDays = {
  auditLogs: 400,
  emailLogs: 180,
  eventScheduledJobs: 90,
  operationalEvents: 180,
} as const;

export const operationalRecordTtlField = "retentionExpiresAt";

export function getRetentionExpiration(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
