/** Bounded operating limits shared by staging validation and production-intended paths. */
export const communityHubLimits = {
  publishedChurches: 500,
  sitemapEvents: 1_000,
  registrationsPerExport: 1_000,
  participantsPerRegistration: 25,
  generatedExportBytes: 10 * 1024 * 1024,
  adminEventSearchScan: 500,
  schedulerBatchSize: 25,
  cleanupBatchSize: 400,
} as const;
