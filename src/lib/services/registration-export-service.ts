import { randomUUID } from "crypto";

import { createSlug } from "@/lib/firebase/firestore";
import {
  deleteFirebaseStorageObjectIfPresent,
  downloadPrivateEventExport,
  uploadPrivateEventExport,
} from "@/lib/firebase/storage";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  deleteEventExportRecord,
  getEventExportRecord,
  listExpiredEventExports,
  saveEventExportRecord,
  updateEventExportRecord,
} from "@/lib/repositories/firebase-event-export-repository";
import { getEventByIdFromFirebase } from "@/lib/repositories/firebase-event-repository";
import {
  listAllRegistrationsForEvent,
  getRegistrationConfiguration,
  listRegistrationFormVersions,
} from "@/lib/repositories/firebase-registration-repository";
import { requireChurchEventManagementAccess } from "@/lib/services/representative-access-service";
import { sendTransactionalEmail } from "@/lib/services/email-service";
import {
  generateRegistrationPdf,
  generateRegistrationWorkbook,
  resolveExportFields,
} from "@/lib/services/registration-report-service";
import type {
  EventExportRecord,
  RegistrationExportFormat,
  RegistrationPdfType,
} from "@/lib/types/registrations";
import { communityHubLimits } from "@/lib/community-hub-limits";

async function requireEventExportAccess(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireChurchEventManagementAccess({ churchId: input.churchId, userId: input.actorUserId });
  const event = await getEventByIdFromFirebase(input.eventId);
  if (!event || event.churchId !== input.churchId) throw new Error("The event does not belong to this church.");
  return { ...access, event };
}

export function validateRegistrationReportRecipients(input: {
  recipients: string[];
  approvedRecipients: Array<string | null | undefined>;
}) {
  const approvedRecipients = new Set(
    input.approvedRecipients
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase()),
  );
  const recipients = [
    ...new Set(
      input.recipients
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (recipients.length === 0 || recipients.some((recipient) => !approvedRecipients.has(recipient))) {
    throw new Error("Reports may be emailed only to the signed-in representative, event contact, or church email address.");
  }

  return recipients;
}

export async function createRegistrationExport(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  format: RegistrationExportFormat;
  reportType: RegistrationPdfType | "workbook";
  orientation?: "portrait" | "landscape";
  selectedFieldIds: string[];
  includeSensitive: boolean;
}) {
  const access = await requireEventExportAccess(input);
  if (
    (input.format !== "pdf" && input.format !== "xlsx") ||
    !["roster", "sign_in", "check_in", "workbook"].includes(input.reportType) ||
    (input.format === "pdf" && input.reportType === "workbook") ||
    (input.format === "xlsx" && input.reportType !== "workbook")
  ) {
    throw new Error("Choose a valid registration report format and layout.");
  }
  const [registrations, formVersions, configuration] = await Promise.all([
    listAllRegistrationsForEvent(input.eventId),
    listRegistrationFormVersions(input.eventId),
    getRegistrationConfiguration(input.eventId),
  ]);
  resolveExportFields({ formVersions, selectedFieldIds: input.selectedFieldIds, includeSensitive: input.includeSensitive });

  const exportId = randomUUID();
  const correlationId = randomUUID();
  const extension = input.format;
  const contentType = input.format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const buffer = input.format === "pdf"
    ? await generateRegistrationPdf({
        event: access.event,
        configuration,
        registrations,
        formVersions,
        selectedFieldIds: input.selectedFieldIds,
        includeSensitive: input.includeSensitive,
        reportType: input.reportType === "workbook" ? "roster" : input.reportType,
        orientation: input.orientation ?? "portrait",
      })
    : await generateRegistrationWorkbook({
        event: access.event,
        configuration,
        registrations,
        formVersions,
        selectedFieldIds: input.selectedFieldIds,
        includeSensitive: input.includeSensitive,
      });

  if (buffer.byteLength > communityHubLimits.generatedExportBytes) {
    throw new Error(
      `The generated report exceeded the supported ${Math.floor(communityHubLimits.generatedExportBytes / 1024 / 1024)} MB export size. Select fewer fields or export a smaller event.`,
    );
  }

  const fileName = `${createSlug(access.event.title) || "event"}-${input.reportType}.${extension}`;
  const storagePath = await uploadPrivateEventExport({
    churchId: input.churchId,
    eventId: input.eventId,
    exportId,
    extension,
    contentType,
    buffer,
  });
  const now = new Date().toISOString();
  const record: EventExportRecord = {
    id: exportId,
    eventId: input.eventId,
    churchId: input.churchId,
    requestedByUserId: input.actorUserId,
    format: input.format,
    reportType: input.reportType,
    orientation: input.format === "pdf" ? input.orientation ?? "portrait" : undefined,
    selectedFieldIds: input.selectedFieldIds,
    sensitiveFieldsIncluded: input.includeSensitive,
    storagePath,
    contentType,
    fileName,
    createdAt: now,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    downloadedAt: null,
    emailedAt: null,
    correlationId,
  };
  await saveEventExportRecord(record);
  await createAuditLogInFirebase({
    entityType: "eventExport",
    entityId: exportId,
    action: "registration_export_created",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: {
      eventId: input.eventId,
      churchId: input.churchId,
      format: input.format,
      reportType: input.reportType,
      selectedFieldIds: input.selectedFieldIds,
      sensitiveFieldsIncluded: input.includeSensitive,
      expiresAt: record.expiresAt,
      correlationId,
    },
    note: "Private registration export created. Registration values are omitted from the audit log.",
  });
  return { record, buffer };
}

export async function downloadManagedRegistrationExport(input: {
  exportId: string;
  actorUserId: string;
}) {
  const record = await getEventExportRecord(input.exportId);
  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new Error("This export has expired or no longer exists.");
  }
  await requireEventExportAccess({ eventId: record.eventId, churchId: record.churchId, actorUserId: input.actorUserId });
  const buffer = await downloadPrivateEventExport(record.storagePath);
  await updateEventExportRecord(record.id, { downloadedAt: new Date().toISOString() });
  return { record, buffer };
}

export async function emailRegistrationExport(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  recipients: string[];
  message?: string;
  formats: RegistrationExportFormat[];
  reportType: RegistrationPdfType;
  selectedFieldIds: string[];
  includeSensitive: boolean;
  orientation: "portrait" | "landscape";
}) {
  const access = await requireEventExportAccess(input);
  const formats = [...new Set(input.formats)];
  if (formats.length === 0 || formats.some((format) => format !== "pdf" && format !== "xlsx")) {
    throw new Error("Choose at least one valid report format.");
  }
  if (!["roster", "sign_in", "check_in"].includes(input.reportType)) {
    throw new Error("Choose a valid PDF report layout.");
  }
  const recipients = validateRegistrationReportRecipients({
    recipients: input.recipients,
    approvedRecipients: [access.profile.email, access.event.contactEmail, access.church.email],
  });

  const exports = await Promise.all(formats.map((format) => createRegistrationExport({
    eventId: input.eventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    format,
    reportType: format === "xlsx" ? "workbook" : input.reportType,
    orientation: input.orientation,
    selectedFieldIds: input.selectedFieldIds,
    includeSensitive: input.includeSensitive,
  })));
  const attachments = exports.map(({ record, buffer }) => ({ filename: record.fileName, content: buffer, contentType: record.contentType }));

  for (const recipient of recipients) {
    await sendTransactionalEmail({
      to: recipient,
      subject: `Registration report for ${access.event.title}`,
      body: [
        `An authorized representative of ${access.church.name} requested the attached registration report for ${access.event.title}.`,
        "",
        input.message?.trim().slice(0, 1000) || "Please handle this report as private church event information.",
        "",
        "Sensitive registration information should not be forwarded or stored longer than needed.",
      ].join("\n"),
      attachments,
      relatedEntityType: "event",
      relatedEntityId: input.eventId,
    });
  }

  const emailedAt = new Date().toISOString();
  await Promise.all(exports.map(({ record }) => updateEventExportRecord(record.id, { emailedAt })));
  await createAuditLogInFirebase({
    entityType: "event",
    entityId: input.eventId,
    action: "registration_report_emailed",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: {
      recipients,
      formats,
      reportType: input.reportType,
      selectedFieldIds: input.selectedFieldIds,
      sensitiveFieldsIncluded: input.includeSensitive,
    },
    note: "Registration report emailed. Field values are omitted from email and audit logs.",
  });
}

export async function cleanupExpiredRegistrationExports() {
  const expired = await listExpiredEventExports();
  let deleted = 0;
  for (const record of expired) {
    try {
      await deleteFirebaseStorageObjectIfPresent(record.storagePath);
      await deleteEventExportRecord(record.id);
      deleted += 1;
    } catch {
      console.warn(`Expired registration export cleanup skipped record ${record.id}.`);
    }
  }
  return deleted;
}
