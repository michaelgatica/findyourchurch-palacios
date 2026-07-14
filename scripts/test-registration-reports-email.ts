import assert from "node:assert/strict";

import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

import { getDefaultRegistrationConfiguration } from "@/lib/validation/registration";
import {
  generateRegistrationPdf,
  generateRegistrationWorkbook,
  resolveExportFields,
} from "@/lib/services/registration-report-service";
import { validateRegistrationReportRecipients } from "@/lib/services/registration-export-service";
import {
  buildEventCancellationEmail,
  buildEventReminderEmail,
  buildOrganizerRegistrationNotificationEmail,
  buildRegistrantRegistrationConfirmationEmail,
  buildRegistrationCancellationNotificationEmail,
  buildRegistrationUpdatedNotificationEmail,
  buildWaitlistPromotionNotificationEmail,
} from "@/lib/services/registration-notification-service";
import type { EventRecord } from "@/lib/types/events";
import type {
  RegistrationFieldSchema,
  RegistrationFormVersionRecord,
  RegistrationRecord,
} from "@/lib/types/registrations";

function field(
  id: string,
  label: string,
  type: RegistrationFieldSchema["type"],
  displayOrder: number,
  options: Partial<RegistrationFieldSchema> = {},
): RegistrationFieldSchema {
  return {
    id,
    label,
    type,
    displayOrder,
    required: options.required ?? false,
    options: options.options ?? [],
    includeInExports: options.includeInExports ?? true,
    sensitiveClassification: options.sensitiveClassification ?? "none",
    minValue: options.minValue ?? null,
    maxValue: options.maxValue ?? null,
    minSelections: options.minSelections ?? null,
    maxSelections: options.maxSelections ?? null,
    minLength: options.minLength ?? null,
    maxLength: options.maxLength ?? null,
    defaultValue: options.defaultValue ?? null,
    condition: options.condition ?? null,
    participantFields: options.participantFields,
  };
}

async function run() {
  const event = {
    id: "event-report-test",
    churchId: "church-report-test",
    churchName: "Report Test Church",
    title: "Community Workshop",
    slug: "community-workshop",
    startsAt: "2030-09-10T23:00:00.000Z",
    endsAt: "2030-09-11T01:00:00.000Z",
    timeZone: "America/Chicago",
    status: "published",
    contactEmail: "events@church.example",
    cancellationMessage: "The host church will share a new date soon.",
  } as EventRecord;
  const safeNotes = field("safe_notes", "Notes", "short_text", 0);
  const mealChoice = field("meal_choice", "Meal choice", "dropdown", 1, {
    options: [
      { id: "meal-one", label: "Standard", value: "standard" },
      { id: "meal-two", label: "Vegetarian", value: "vegetarian" },
    ],
  });
  const allergies = field("allergies", "Allergies", "long_text", 2, {
    sensitiveClassification: "health_accommodation",
  });
  const participantName = field("child_name", "Child name", "full_name", 0, {
    sensitiveClassification: "minor",
  });
  const children = field("children", "Children", "repeating_child_group", 3, {
    sensitiveClassification: "minor",
    participantFields: [participantName],
  });
  const formVersion: RegistrationFormVersionRecord = {
    id: "form-version-one",
    eventId: event.id,
    churchId: event.churchId,
    version: 1,
    status: "active",
    title: "Workshop registration",
    sections: [{
      id: "section-one",
      title: "Registration",
      displayOrder: 0,
      fields: [safeNotes, mealChoice, allergies, children],
    }],
    schemaFingerprint: "test-fingerprint",
    createdByUserId: "user-one",
    createdAt: "2030-01-01T00:00:00.000Z",
    activatedAt: "2030-01-01T00:00:00.000Z",
    retiredAt: null,
  };
  const registration: RegistrationRecord = {
    id: "registration-one",
    eventId: event.id,
    churchId: event.churchId,
    formVersionId: formVersion.id,
    formVersion: 1,
    formTitle: formVersion.title,
    confirmationNumber: "FYC-ABCDEF123456",
    status: "confirmed",
    contactName: "Grace Tester",
    contactNameNormalized: "grace tester",
    contactSearchPrefixes: ["gr", "gra", "grace", "te", "test", "tester"],
    contactEmail: "grace@example.test",
    contactPhone: "361-555-0100",
    attendeeCount: 2,
    capacityUnits: 2,
    answers: {
      safe_notes: "=HYPERLINK(\"https://malicious.example\")",
      meal_choice: "vegetarian",
      allergies: "Private allergy detail",
      children: [{ child_name: "Child Tester" }],
    },
    answerLabels: {
      safe_notes: "Notes",
      meal_choice: "Meal choice",
      allergies: "Allergies",
      children: "Children",
    },
    privateOrganizerNotes: "Private organizer note",
    source: "public",
    idempotencyKeyHash: "test-hash",
    submittedAt: "2030-08-01T12:00:00.000Z",
    updatedAt: "2030-08-01T12:00:00.000Z",
    cancelledAt: null,
    checkedInAt: null,
    attendedAt: null,
    noShowAt: null,
    lastEditedByUserId: null,
  };
  const configuration = getDefaultRegistrationConfiguration({
    eventId: event.id,
    churchId: event.churchId,
    mode: "internal_custom",
    actorUserId: "user-one",
    capacity: 100,
  });
  const reportInput = {
    event,
    configuration,
    registrations: [registration],
    formVersions: [formVersion],
    selectedFieldIds: [safeNotes.id, mealChoice.id],
    includeSensitive: false,
  };

  for (const reportType of ["roster", "sign_in", "check_in"] as const) {
    for (const orientation of ["portrait", "landscape"] as const) {
      const pdfBuffer = await generateRegistrationPdf({ ...reportInput, reportType, orientation });
      assert.equal(pdfBuffer.subarray(0, 4).toString(), "%PDF");
      const pdf = await PDFDocument.load(pdfBuffer);
      assert.ok(pdf.getPageCount() >= 1);
      assert.equal(pdf.getAuthor(), "El Roi Digital Ministries");
      assert.equal(pdf.getCreator(), "Find Your Church Palacios");
      assert.match(pdf.getSubject() ?? "", /Find Your Church Palacios/);
      const [width, height] = pdf.getPage(0).getSize().width > pdf.getPage(0).getSize().height
        ? ["landscape", "portrait"]
        : ["portrait", "landscape"];
      assert.equal(width, orientation);
      assert.notEqual(height, orientation);
    }
  }

  const defaultFields = resolveExportFields({
    formVersions: [formVersion],
    selectedFieldIds: [],
    includeSensitive: false,
  });
  assert.deepEqual(defaultFields.map((entry) => entry.id), ["safe_notes", "meal_choice"]);
  assert.throws(
    () => resolveExportFields({ formVersions: [formVersion], selectedFieldIds: ["allergies"], includeSensitive: false }),
    /deliberate confirmation/i,
  );

  const workbookBuffer = await generateRegistrationWorkbook({
    ...reportInput,
    selectedFieldIds: [safeNotes.id, mealChoice.id, children.id],
    includeSensitive: true,
  });
  const workbook = new ExcelJS.Workbook();
  // ExcelJS still declares Buffer as an ArrayBuffer subtype, which conflicts with
  // the generic Buffer declaration in current Node types.
  await workbook.xlsx.load(workbookBuffer as never);
  assert.ok(workbook.getWorksheet("Event Summary"));
  assert.ok(workbook.getWorksheet("Registrations"));
  assert.ok(workbook.getWorksheet("Participants"));
  assert.ok(workbook.getWorksheet("Answer Summary"));
  assert.equal(workbook.creator, "Find Your Church Palacios / El Roi Digital Ministries");
  assert.match(workbook.description ?? "", /provided free of charge/i);
  assert.equal(
    workbook.getWorksheet("Event Summary")?.getCell("B12").hyperlink,
    "https://elroidigital.org/donate.html",
  );
  const registrationsSheet = workbook.getWorksheet("Registrations");
  assert.ok(registrationsSheet);
  const registrationsHeaderFill = registrationsSheet!.getRow(1).fill;
  assert.equal(
    registrationsHeaderFill.type === "pattern"
      ? registrationsHeaderFill.fgColor?.argb
      : undefined,
    "0B4A24",
  );
  assert.match(registrationsSheet!.headerFooter.oddFooter ?? "", /provided free/i);
  const headerValues = registrationsSheet!.getRow(1).values;
  assert.ok(Array.isArray(headerValues));
  const notesColumn = headerValues.findIndex((value) => value === "Notes");
  assert.ok(notesColumn > 0);
  assert.match(String(registrationsSheet!.getRow(2).getCell(notesColumn).value), /^'/);
  assert.equal(registrationsSheet!.autoFilter !== undefined, true);
  assert.equal(registrationsSheet!.views[0]?.state, "frozen");
  const summaryHeaderFill = workbook.getWorksheet("Event Summary")!.getRow(1).fill;
  assert.equal(summaryHeaderFill.type === "pattern" ? summaryHeaderFill.fgColor?.argb : undefined, "06381C");

  const approvedRecipients = validateRegistrationReportRecipients({
    recipients: ["GRACE@EXAMPLE.TEST", "events@church.example", "grace@example.test"],
    approvedRecipients: ["grace@example.test", "events@church.example"],
  });
  assert.deepEqual(approvedRecipients, ["grace@example.test", "events@church.example"]);
  assert.throws(
    () => validateRegistrationReportRecipients({
      recipients: ["attacker@example.test"],
      approvedRecipients: ["events@church.example"],
    }),
    /only to the signed-in representative/i,
  );

  const notificationBuilders = [
    buildRegistrantRegistrationConfirmationEmail({ event, registration, accessToken: "safe-token", managementEnabled: true }),
    buildRegistrationUpdatedNotificationEmail({ event, registration, accessToken: "safe-token" }),
    buildWaitlistPromotionNotificationEmail({ event, registration: { ...registration, status: "confirmed" } }),
    buildRegistrationCancellationNotificationEmail({ event, registration: { ...registration, status: "cancelled" } }),
    buildEventCancellationEmail({ event, registration }),
    buildEventReminderEmail({ event, registration }),
    buildOrganizerRegistrationNotificationEmail({ event, registration, capacityReached: true }),
  ];
  for (const email of notificationBuilders) {
    assert.ok(email);
    assert.doesNotMatch(email!.subject, /allergy|private organizer/i);
    assert.doesNotMatch(email!.body, /Private allergy detail|Private organizer note/i);
    assert.equal(email!.relatedEntityId, registration.id);
  }
  const waitlistEmail = buildRegistrantRegistrationConfirmationEmail({
    event,
    registration: { ...registration, status: "waitlisted" },
    accessToken: "safe-token",
    managementEnabled: true,
  });
  assert.match(waitlistEmail!.subject, /Waitlist confirmation/);
  assert.match(buildOrganizerRegistrationNotificationEmail({ event, registration, capacityReached: true })!.body, /capacity has been reached/i);

  console.log(JSON.stringify({
    ok: true,
    suite: "registration-reports-email",
    pdfVariants: 6,
    workbookSheets: workbook.worksheets.map((worksheet) => worksheet.name),
    emailTemplates: notificationBuilders.length + 1,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
