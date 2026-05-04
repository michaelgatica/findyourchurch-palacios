import { randomUUID } from "crypto";

import {
  buildAbsoluteUrl,
  buildChurchProfilePath,
} from "@/lib/config/site";
import { safeRevalidatePath } from "@/lib/revalidation";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  getChurchByIdFromFirebase,
  getChurchByVerificationTokenFromFirebase,
  getChurchDocumentByIdFromFirebase,
  listChurchesFromFirebase,
  saveChurchDocumentToFirebase,
} from "@/lib/repositories/firebase-church-repository";
import { listChurchRepresentativesForChurch } from "@/lib/repositories/firebase-representative-repository";
import type {
  ChurchDocument,
  ChurchListingVerificationStatus,
  ChurchRecord,
} from "@/lib/types/directory";

import {
  sendAnnualListingArchivedNotification,
  sendAnnualListingVerificationNotification,
  sendAnnualListingVerificationReminder3Notification,
  sendAnnualListingVerificationReminder7Notification,
} from "@/lib/services/notification-service";

const ANNUAL_VERIFICATION_GRACE_DAYS = 14;
const ANNUAL_VERIFICATION_REMINDER_7_DAYS = 7;
const ANNUAL_VERIFICATION_REMINDER_3_DAYS = 3;
const REPRESENTATIVE_ACTIVITY_THROTTLE_MS = 24 * 60 * 60 * 1000;

export interface ListingVerificationProcessingSummary {
  dryRun: boolean;
  processedAt: string;
  checked: number;
  requestsStarted: number;
  reminders7Sent: number;
  reminders3Sent: number;
  archived: number;
  resetToCurrent: number;
  skippedNoRecipient: number;
  errors: string[];
}

interface VerificationRecipient {
  email: string;
  name: string;
}

function toDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const resolvedDate = new Date(value);

  if (Number.isNaN(resolvedDate.getTime())) {
    return null;
  }

  return resolvedDate;
}

function addDays(sourceDate: Date, days: number) {
  const nextDate = new Date(sourceDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addYears(sourceDate: Date, years: number) {
  const nextDate = new Date(sourceDate);
  nextDate.setUTCFullYear(nextDate.getUTCFullYear() + years);
  return nextDate;
}

function createListingVerificationToken() {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
}

function resolveListingVerificationBaselineIso(church: ChurchRecord) {
  const candidates = [
    church.lastRepresentativeActivityAt,
    church.lastListingAcknowledgedAt,
    church.lastVerifiedAt,
    church.publishedAt,
    church.createdAt,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return new Date().toISOString();
  }

  return candidates.sort((leftValue, rightValue) => {
    const leftDate = toDate(leftValue)?.getTime() ?? 0;
    const rightDate = toDate(rightValue)?.getTime() ?? 0;
    return rightDate - leftDate;
  })[0];
}

function buildVerificationLink(token: string) {
  return buildAbsoluteUrl(`/listing-acknowledge?token=${encodeURIComponent(token)}`);
}

function buildCurrentVerificationDocument(
  churchDocument: ChurchDocument,
  options?: {
    lastListingAcknowledgedAt?: string | null;
    lastRepresentativeActivityAt?: string | null;
    lastVerifiedAt?: string | null;
  },
): ChurchDocument {
  return {
    ...churchDocument,
    listingVerificationStatus:
      churchDocument.status === "archived" ? "archived" : "current",
    lastListingAcknowledgedAt:
      options?.lastListingAcknowledgedAt ?? churchDocument.lastListingAcknowledgedAt ?? null,
    lastRepresentativeActivityAt:
      options?.lastRepresentativeActivityAt ?? churchDocument.lastRepresentativeActivityAt ?? null,
    lastVerifiedAt: options?.lastVerifiedAt ?? churchDocument.lastVerifiedAt ?? null,
    listingVerificationRequestedAt: null,
    listingVerificationGraceEndsAt: null,
    listingVerificationReminder7SentAt: null,
    listingVerificationReminder3SentAt: null,
    listingVerificationToken: null,
    archivedAt: churchDocument.status === "archived" ? churchDocument.archivedAt ?? null : null,
    archivedReason:
      churchDocument.status === "archived" ? churchDocument.archivedReason ?? null : null,
  };
}

function buildVerificationStateDocument(
  churchDocument: ChurchDocument,
  input: {
    verificationStatus: ChurchListingVerificationStatus;
    requestedAt: string;
    graceEndsAt: string;
    reminder7SentAt?: string | null;
    reminder3SentAt?: string | null;
    token?: string | null;
  },
): ChurchDocument {
  return {
    ...churchDocument,
    listingVerificationStatus: input.verificationStatus,
    listingVerificationRequestedAt: input.requestedAt,
    listingVerificationGraceEndsAt: input.graceEndsAt,
    listingVerificationReminder7SentAt: input.reminder7SentAt ?? null,
    listingVerificationReminder3SentAt: input.reminder3SentAt ?? null,
    listingVerificationToken:
      input.token ?? churchDocument.listingVerificationToken ?? null,
  };
}

async function getVerificationRecipient(church: ChurchRecord): Promise<VerificationRecipient | null> {
  const representatives = (await listChurchRepresentativesForChurch(church.id)).filter(
    (representative) =>
      representative.status === "active" &&
      (representative.permissionRole === "primary_owner" ||
        representative.permissionRole === "editor") &&
      Boolean(representative.email),
  );
  const primaryRepresentative =
    representatives.find(
      (representative) => representative.permissionRole === "primary_owner",
    ) ?? representatives[0];

  if (primaryRepresentative?.email) {
    return {
      email: primaryRepresentative.email,
      name: primaryRepresentative.name,
    };
  }

  if (church.email) {
    return {
      email: church.email,
      name: church.name,
    };
  }

  return null;
}

async function saveVerificationDocumentIfNeeded(input: {
  churchDocument: ChurchDocument;
  dryRun: boolean;
}) {
  if (input.dryRun) {
    return input.churchDocument;
  }

  return saveChurchDocumentToFirebase(input.churchDocument);
}

async function logVerificationAuditIfNeeded(input: {
  dryRun: boolean;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}) {
  if (input.dryRun) {
    return;
  }

  await createAuditLogInFirebase({
    entityType: "church",
    entityId: input.entityId,
    action: input.action,
    actorType: "system",
    before: input.before,
    after: input.after,
    note: input.note,
  });
}

export async function touchChurchListingRepresentativeActivity(input: {
  churchId: string;
  occurredAt?: string;
}) {
  const churchDocument = await getChurchDocumentByIdFromFirebase(input.churchId);

  if (!churchDocument || churchDocument.status !== "published") {
    return churchDocument
      ? {
          church: await getChurchByIdFromFirebase(churchDocument.id),
          updated: false,
        }
      : { church: null, updated: false };
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const lastRepresentativeActivityAt = toDate(churchDocument.lastRepresentativeActivityAt);
  const occurredAtDate = toDate(occurredAt) ?? new Date();
  const recentlyTouched =
    lastRepresentativeActivityAt &&
    occurredAtDate.getTime() - lastRepresentativeActivityAt.getTime() <
      REPRESENTATIVE_ACTIVITY_THROTTLE_MS &&
    churchDocument.listingVerificationStatus !== "acknowledgement_due" &&
    churchDocument.listingVerificationStatus !== "grace_period";

  if (recentlyTouched) {
    return {
      church: await getChurchByIdFromFirebase(churchDocument.id),
      updated: false,
    };
  }

  const updatedChurchDocument = buildCurrentVerificationDocument(churchDocument, {
    lastRepresentativeActivityAt: occurredAt,
  });
  const wasPendingVerification =
    churchDocument.listingVerificationStatus === "acknowledgement_due" ||
    churchDocument.listingVerificationStatus === "grace_period";

  await saveChurchDocumentToFirebase(updatedChurchDocument);

  if (wasPendingVerification) {
    await createAuditLogInFirebase({
      entityType: "church",
      entityId: churchDocument.id,
      action: "listing_verification_confirmed_by_portal_activity",
      actorType: "church_rep",
      before: {
        listingVerificationStatus: churchDocument.listingVerificationStatus,
        listingVerificationRequestedAt: churchDocument.listingVerificationRequestedAt,
        listingVerificationGraceEndsAt: churchDocument.listingVerificationGraceEndsAt,
      },
      after: {
        listingVerificationStatus: updatedChurchDocument.listingVerificationStatus,
        lastRepresentativeActivityAt: updatedChurchDocument.lastRepresentativeActivityAt,
      },
      note: "Representative portal activity confirmed the church listing is still active.",
    });
  }

  return {
    church: await getChurchByIdFromFirebase(churchDocument.id),
    updated: true,
  };
}

export async function acknowledgeChurchListingByToken(listingVerificationToken: string) {
  const church = await getChurchByVerificationTokenFromFirebase(listingVerificationToken);

  if (!church) {
    return {
      status: "invalid" as const,
      church: null,
    };
  }

  if (church.status !== "published") {
    return {
      status: church.status === "archived" ? ("archived" as const) : ("invalid" as const),
      church,
    };
  }

  const churchDocument = await getChurchDocumentByIdFromFirebase(church.id);

  if (!churchDocument) {
    return {
      status: "invalid" as const,
      church: null,
    };
  }

  const now = new Date().toISOString();
  const updatedChurchDocument = buildCurrentVerificationDocument(churchDocument, {
    lastListingAcknowledgedAt: now,
    lastVerifiedAt: now,
  });

  await saveChurchDocumentToFirebase(updatedChurchDocument);
  await createAuditLogInFirebase({
    entityType: "church",
    entityId: church.id,
    action: "listing_verification_acknowledged",
    actorType: "church_rep",
    before: {
      listingVerificationStatus: churchDocument.listingVerificationStatus,
      listingVerificationRequestedAt: churchDocument.listingVerificationRequestedAt,
      listingVerificationGraceEndsAt: churchDocument.listingVerificationGraceEndsAt,
    },
    after: {
      listingVerificationStatus: updatedChurchDocument.listingVerificationStatus,
      lastListingAcknowledgedAt: updatedChurchDocument.lastListingAcknowledgedAt,
      lastVerifiedAt: updatedChurchDocument.lastVerifiedAt,
    },
    note: "The church listing was confirmed as active from an email acknowledgement link.",
  });

  safeRevalidatePath("/");
  safeRevalidatePath("/churches");
  safeRevalidatePath(buildChurchProfilePath(church));

  return {
    status: "acknowledged" as const,
    church: await getChurchByIdFromFirebase(church.id),
  };
}

export async function processAnnualListingVerifications(options?: {
  dryRun?: boolean;
  processedAt?: Date;
}) {
  const processedAt = options?.processedAt ?? new Date();
  const processedAtIso = processedAt.toISOString();
  const dryRun = options?.dryRun ?? false;
  const summary: ListingVerificationProcessingSummary = {
    dryRun,
    processedAt: processedAtIso,
    checked: 0,
    requestsStarted: 0,
    reminders7Sent: 0,
    reminders3Sent: 0,
    archived: 0,
    resetToCurrent: 0,
    skippedNoRecipient: 0,
    errors: [],
  };
  const publishedChurches = await listChurchesFromFirebase({
    status: "published",
  });

  for (const church of publishedChurches) {
    summary.checked += 1;

    try {
      const churchDocument = await getChurchDocumentByIdFromFirebase(church.id);

      if (!churchDocument) {
        summary.errors.push(`Church ${church.id} could not be loaded from Firestore.`);
        continue;
      }

      const baselineIso = resolveListingVerificationBaselineIso(church);
      const baselineDate = toDate(baselineIso) ?? processedAt;
      const dueAt = addYears(baselineDate, 1);
      const requestedAt = toDate(churchDocument.listingVerificationRequestedAt);

      if (requestedAt && baselineDate.getTime() > requestedAt.getTime()) {
        const resetChurchDocument = buildCurrentVerificationDocument(churchDocument);

        await saveVerificationDocumentIfNeeded({
          churchDocument: resetChurchDocument,
          dryRun,
        });
        await logVerificationAuditIfNeeded({
          dryRun,
          entityId: church.id,
          action: "listing_verification_cycle_reset",
          before: churchDocument,
          after: resetChurchDocument,
          note: "The church listing had newer confirmed activity, so the verification cycle was cleared.",
        });
        summary.resetToCurrent += 1;
        continue;
      }

      if (!requestedAt) {
        if (processedAt.getTime() < dueAt.getTime()) {
          continue;
        }

        const verificationToken =
          churchDocument.listingVerificationToken ?? createListingVerificationToken();
        const graceEndsAtIso = addDays(
          processedAt,
          ANNUAL_VERIFICATION_GRACE_DAYS,
        ).toISOString();
        const dueChurchDocument = buildVerificationStateDocument(churchDocument, {
          verificationStatus: "acknowledgement_due",
          requestedAt: processedAtIso,
          graceEndsAt: graceEndsAtIso,
          token: verificationToken,
        });
        const recipient = await getVerificationRecipient(church);

        await saveVerificationDocumentIfNeeded({
          churchDocument: dueChurchDocument,
          dryRun,
        });
        await logVerificationAuditIfNeeded({
          dryRun,
          entityId: church.id,
          action: "listing_verification_requested",
          before: churchDocument,
          after: dueChurchDocument,
          note: "Annual listing verification email cycle started.",
        });

        if (recipient) {
          if (!dryRun) {
            await sendAnnualListingVerificationNotification({
              church,
              recipientEmail: recipient.email,
              acknowledgementUrl: buildVerificationLink(verificationToken),
            });
          }
        } else {
          summary.skippedNoRecipient += 1;
        }

        summary.requestsStarted += 1;
        continue;
      }

      const graceEndsAt =
        toDate(churchDocument.listingVerificationGraceEndsAt) ??
        addDays(requestedAt, ANNUAL_VERIFICATION_GRACE_DAYS);
      const recipient = await getVerificationRecipient(church);

      if (processedAt.getTime() >= graceEndsAt.getTime()) {
        const archivedChurchDocument: ChurchDocument = {
          ...churchDocument,
          status: "archived",
          listingVerificationStatus: "archived",
          archivedAt: processedAtIso,
          archivedReason: "annual_verification_not_acknowledged",
          listingVerificationToken: null,
          updatedAt: processedAtIso,
        };

        await saveVerificationDocumentIfNeeded({
          churchDocument: archivedChurchDocument,
          dryRun,
        });
        await logVerificationAuditIfNeeded({
          dryRun,
          entityId: church.id,
          action: "listing_archived_for_inactivity",
          before: churchDocument,
          after: archivedChurchDocument,
          note: "The listing was archived after the annual verification grace period expired.",
        });

        if (recipient) {
          if (!dryRun) {
            await sendAnnualListingArchivedNotification({
              church,
              recipientEmail: recipient.email,
            });
          }
        } else {
          summary.skippedNoRecipient += 1;
        }

        if (!dryRun) {
          safeRevalidatePath("/");
          safeRevalidatePath("/churches");
          safeRevalidatePath(buildChurchProfilePath(church));
        }

        summary.archived += 1;
        continue;
      }

      const reminder3At = addDays(graceEndsAt, -ANNUAL_VERIFICATION_REMINDER_3_DAYS);
      const reminder7At = addDays(graceEndsAt, -ANNUAL_VERIFICATION_REMINDER_7_DAYS);

      if (
        processedAt.getTime() >= reminder3At.getTime() &&
        !churchDocument.listingVerificationReminder3SentAt
      ) {
        const updatedChurchDocument = buildVerificationStateDocument(churchDocument, {
          verificationStatus: "grace_period",
          requestedAt: requestedAt.toISOString(),
          graceEndsAt: graceEndsAt.toISOString(),
          reminder7SentAt: churchDocument.listingVerificationReminder7SentAt ?? null,
          reminder3SentAt: processedAtIso,
        });

        await saveVerificationDocumentIfNeeded({
          churchDocument: updatedChurchDocument,
          dryRun,
        });
        await logVerificationAuditIfNeeded({
          dryRun,
          entityId: church.id,
          action: "listing_verification_3_day_warning_sent",
          before: churchDocument,
          after: updatedChurchDocument,
          note: "A final 3-day annual verification warning was sent.",
        });

        if (recipient) {
          if (!dryRun) {
            await sendAnnualListingVerificationReminder3Notification({
              church,
              recipientEmail: recipient.email,
              acknowledgementUrl: buildVerificationLink(
                updatedChurchDocument.listingVerificationToken ?? createListingVerificationToken(),
              ),
            });
          }
        } else {
          summary.skippedNoRecipient += 1;
        }

        summary.reminders3Sent += 1;
        continue;
      }

      if (
        processedAt.getTime() >= reminder7At.getTime() &&
        !churchDocument.listingVerificationReminder7SentAt
      ) {
        const updatedChurchDocument = buildVerificationStateDocument(churchDocument, {
          verificationStatus: "grace_period",
          requestedAt: requestedAt.toISOString(),
          graceEndsAt: graceEndsAt.toISOString(),
          reminder7SentAt: processedAtIso,
          reminder3SentAt: churchDocument.listingVerificationReminder3SentAt ?? null,
        });

        await saveVerificationDocumentIfNeeded({
          churchDocument: updatedChurchDocument,
          dryRun,
        });
        await logVerificationAuditIfNeeded({
          dryRun,
          entityId: church.id,
          action: "listing_verification_7_day_warning_sent",
          before: churchDocument,
          after: updatedChurchDocument,
          note: "A 7-day annual verification reminder was sent.",
        });

        if (recipient) {
          if (!dryRun) {
            await sendAnnualListingVerificationReminder7Notification({
              church,
              recipientEmail: recipient.email,
              acknowledgementUrl: buildVerificationLink(
                updatedChurchDocument.listingVerificationToken ?? createListingVerificationToken(),
              ),
            });
          }
        } else {
          summary.skippedNoRecipient += 1;
        }

        summary.reminders7Sent += 1;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      summary.errors.push(`${church.name}: ${errorMessage}`);
    }
  }

  return summary;
}
