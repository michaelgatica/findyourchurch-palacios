import type { ChurchSubmissionRecord } from "@/lib/types/directory";

export async function queueSubmissionReceivedNotification(
  submission: ChurchSubmissionRecord,
) {
  void submission;

  // TODO: Phase 3 should send ministry team and submitter email notifications
  // here, then persist delivery metadata into the emailLogs collection.
}
