import { buildAbsoluteUrl } from "@/lib/config/site";
import {
  assertApprovedStagingEmailRecipient,
  getStagingEmailTestReadiness,
  sendTransactionalEmail,
  type EmailAttachment,
} from "@/lib/services/email-service";
import { createOperationalEvent } from "@/lib/services/operational-log-service";
import {
  buildEventCancellationEmail,
  buildEventReminderEmail,
  buildOrganizerRegistrationNotificationEmail,
  buildRegistrantRegistrationConfirmationEmail,
  buildRegistrationCancellationNotificationEmail,
  buildRegistrationUpdatedNotificationEmail,
  buildWaitlistPromotionNotificationEmail,
  type RegistrationNotificationEmail,
} from "@/lib/services/registration-notification-service";
import {
  generateRegistrationPdf,
  generateRegistrationWorkbook,
} from "@/lib/services/registration-report-service";
import type { EventRecord } from "@/lib/types/events";
import type { RegistrationRecord } from "@/lib/types/registrations";

export const stagingEmailTemplateDefinitions = [
  { key: "registration_confirmation", label: "Registration confirmation", attachmentSummary: "None" },
  { key: "simple_rsvp_confirmation", label: "Simple RSVP confirmation", attachmentSummary: "None" },
  { key: "waitlist_confirmation", label: "Waitlist confirmation", attachmentSummary: "None" },
  { key: "waitlist_promotion", label: "Waitlist promotion", attachmentSummary: "None" },
  { key: "registration_update", label: "Registration update", attachmentSummary: "None" },
  { key: "registration_cancellation", label: "Registration cancellation", attachmentSummary: "None" },
  { key: "event_cancellation", label: "Event cancellation", attachmentSummary: "None" },
  { key: "event_reminder", label: "Event reminder", attachmentSummary: "None" },
  { key: "new_registration_notification", label: "New registration notification", attachmentSummary: "None" },
  { key: "capacity_reached_notification", label: "Capacity-reached notification", attachmentSummary: "None" },
  { key: "registration_closed_notification", label: "Registration-closed notification", attachmentSummary: "None" },
  { key: "pdf_report", label: "PDF registration report", attachmentSummary: "One PDF" },
  { key: "xlsx_report", label: "XLSX registration report", attachmentSummary: "One XLSX" },
  { key: "combined_report", label: "Combined registration report", attachmentSummary: "PDF and XLSX" },
  { key: "scheduled_digest", label: "Scheduled registration digest", attachmentSummary: "None" },
] as const;

export type StagingEmailTemplateKey = (typeof stagingEmailTemplateDefinitions)[number]["key"];

const sampleEvent = {
  id: "staging-email-test-event",
  churchId: "staging-email-test-church-a",
  churchName: "Staging Test Church A",
  churchSlug: "staging-test-church-a",
  title: "Staging Community Supper",
  slug: "staging-community-supper",
  summary: "Fictitious staging event for email delivery verification.",
  description: "Fictitious staging event for email delivery verification.",
  primaryType: "community",
  audienceTags: ["all-ages"],
  customTags: [],
  status: "published",
  visibility: "public",
  isFeatured: false,
  additionalImages: [],
  startsAt: "2030-09-10T23:00:00.000Z",
  endsAt: "2030-09-11T01:00:00.000Z",
  allDay: false,
  timeZone: "America/Chicago",
  isRecurring: false,
  recurrenceExceptions: [],
  locationMode: "in_person",
  venueName: "Staging Fellowship Hall",
  hostMinistry: "Staging Community Team",
  contactName: "Staging Coordinator",
  contactEmail: "coordinator@example.test",
  languages: ["English"],
  childcareProvided: false,
  mealProvided: true,
  costStatus: "free",
  registration: {
    mode: "simple_rsvp",
    capacity: 25,
    waitlistEnabled: true,
    setupEnabled: true,
  },
  createdAt: "2030-08-01T12:00:00.000Z",
  publishedAt: "2030-08-01T12:00:00.000Z",
  updatedAt: "2030-08-01T12:00:00.000Z",
  wasPublished: true,
} as EventRecord;

const sampleRegistration = {
  id: "staging-email-test-registration",
  eventId: sampleEvent.id,
  churchId: sampleEvent.churchId,
  formVersionId: "staging-form-v1",
  formVersion: 1,
  formTitle: "Staging RSVP",
  confirmationNumber: "STAGE-2030",
  status: "confirmed",
  contactName: "Staging Guest",
  contactNameNormalized: "staging guest",
  contactSearchPrefixes: ["s", "st"],
  contactEmail: "guest@example.test",
  attendeeCount: 2,
  capacityUnits: 2,
  answers: {},
  answerLabels: {},
  source: "public",
  idempotencyKeyHash: "staging-only",
  submittedAt: "2030-08-01T12:00:00.000Z",
  updatedAt: "2030-08-01T12:00:00.000Z",
} as RegistrationRecord;

function requireMessage(message: RegistrationNotificationEmail | null) {
  if (!message) throw new Error("The staging email fixture did not produce a message.");
  return message;
}

async function createReportAttachments(formats: Array<"pdf" | "xlsx">) {
  const commonInput = {
    event: sampleEvent,
    configuration: null,
    registrations: [sampleRegistration],
    formVersions: [],
    selectedFieldIds: [],
    includeSensitive: false,
  };
  const attachments: EmailAttachment[] = [];

  if (formats.includes("pdf")) {
    attachments.push({
      filename: "staging-community-supper-registration-report.pdf",
      content: await generateRegistrationPdf({
        ...commonInput,
        reportType: "roster",
        orientation: "landscape",
      }),
      contentType: "application/pdf",
    });
  }

  if (formats.includes("xlsx")) {
    attachments.push({
      filename: "staging-community-supper-registration-report.xlsx",
      content: await generateRegistrationWorkbook(commonInput),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  return attachments;
}

export async function createStagingEmailMessage(templateKey: StagingEmailTemplateKey) {
  const waitlistedRegistration = {
    ...sampleRegistration,
    id: "staging-email-test-waitlist-registration",
    status: "waitlisted" as const,
  };
  const accessToken = "staging-email-preview-invalid-token";

  switch (templateKey) {
    case "registration_confirmation":
    case "simple_rsvp_confirmation":
      return requireMessage(buildRegistrantRegistrationConfirmationEmail({
        event: sampleEvent,
        registration: sampleRegistration,
        accessToken,
        managementEnabled: true,
      }));
    case "waitlist_confirmation":
      return requireMessage(buildRegistrantRegistrationConfirmationEmail({
        event: sampleEvent,
        registration: waitlistedRegistration,
        accessToken,
        managementEnabled: true,
      }));
    case "waitlist_promotion":
      return requireMessage(buildWaitlistPromotionNotificationEmail({
        event: sampleEvent,
        registration: sampleRegistration,
      }));
    case "registration_update":
      return requireMessage(buildRegistrationUpdatedNotificationEmail({
        event: sampleEvent,
        registration: sampleRegistration,
        accessToken,
      }));
    case "registration_cancellation":
      return requireMessage(buildRegistrationCancellationNotificationEmail({
        event: sampleEvent,
        registration: sampleRegistration,
      }));
    case "event_cancellation":
      return requireMessage(buildEventCancellationEmail({
        event: {
          ...sampleEvent,
          status: "cancelled",
          cancellationMessage: "This is a fictitious staging cancellation.",
        },
        registration: sampleRegistration,
      }));
    case "event_reminder":
      return requireMessage(buildEventReminderEmail({
        event: sampleEvent,
        registration: sampleRegistration,
      }));
    case "new_registration_notification":
      return requireMessage(buildOrganizerRegistrationNotificationEmail({
        event: sampleEvent,
        registration: sampleRegistration,
        capacityReached: false,
      }));
    case "capacity_reached_notification":
      return requireMessage(buildOrganizerRegistrationNotificationEmail({
        event: sampleEvent,
        registration: sampleRegistration,
        capacityReached: true,
      }));
    case "registration_closed_notification":
      return {
        to: sampleEvent.contactEmail!,
        subject: `Registration closed for ${sampleEvent.title}`,
        body: [
          `Registration is closed for ${sampleEvent.title}.`,
          "",
          "This staging message contains totals only and intentionally omits registration answers.",
          `Review the event in staging: ${buildAbsoluteUrl(`/portal/events/${sampleEvent.id}/registration`)}`,
        ].join("\n"),
        relatedEntityType: "event" as const,
        relatedEntityId: sampleEvent.id,
      };
    case "pdf_report":
    case "xlsx_report":
    case "combined_report": {
      const formats = templateKey === "combined_report"
        ? ["pdf", "xlsx"] as const
        : [templateKey === "pdf_report" ? "pdf" : "xlsx"] as const;
      return {
        to: sampleEvent.contactEmail!,
        subject: `Registration report for ${sampleEvent.title}`,
        body: "This fictitious staging report contains no sensitive registration answers.",
        attachments: await createReportAttachments([...formats]),
        relatedEntityType: "event" as const,
        relatedEntityId: sampleEvent.id,
      };
    }
    case "scheduled_digest":
      return {
        to: sampleEvent.contactEmail!,
        subject: `Daily registration summary for ${sampleEvent.title}`,
        body: [
          "Confirmed registrations: 1",
          "Confirmed attendees: 2",
          "Waitlisted registrations: 0",
          "",
          "Sensitive registration answers are not included in this digest.",
          `Open staging event administration: ${buildAbsoluteUrl(`/portal/events/${sampleEvent.id}/registration`)}`,
        ].join("\n"),
        relatedEntityType: "event" as const,
        relatedEntityId: sampleEvent.id,
      };
  }
}

export async function sendStagingEmailTestTemplate(input: {
  templateKey: StagingEmailTemplateKey;
  actorUserId: string;
}) {
  const approvedRecipient = process.env.TEST_EMAIL_TO?.trim();
  if (!approvedRecipient) {
    throw new Error("TEST_EMAIL_TO is not configured.");
  }
  assertApprovedStagingEmailRecipient(approvedRecipient);

  const message = await createStagingEmailMessage(input.templateKey);
  await sendTransactionalEmail({
    ...message,
    to: approvedRecipient,
  });
  await createOperationalEvent({
    type: "staging_email_test_sent",
    severity: "info",
    entityType: "emailTemplate",
    entityId: input.templateKey,
    actorId: input.actorUserId,
    summary: "An authorized staging email template test was sent to the approved recipient.",
    metadata: {
      provider: "smtp",
      attachmentCount: "attachments" in message ? message.attachments?.length ?? 0 : 0,
    },
  });
}

export function getStagingEmailToolStatus() {
  return {
    ...getStagingEmailTestReadiness(),
    templates: stagingEmailTemplateDefinitions,
  };
}
