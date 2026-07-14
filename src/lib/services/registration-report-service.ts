import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import {
  flattenRegistrationFields,
  isSensitiveField,
  maskSensitiveValue,
  neutralizeSpreadsheetFormula,
} from "@/lib/registration-utils";
import type { EventRecord } from "@/lib/types/events";
import type {
  EventRegistrationConfigurationRecord,
  RegistrationAnswerValue,
  RegistrationFieldSchema,
  RegistrationFormVersionRecord,
  RegistrationPdfType,
  RegistrationRecord,
} from "@/lib/types/registrations";

interface ReportInput {
  event: EventRecord;
  configuration: EventRegistrationConfigurationRecord | null;
  registrations: RegistrationRecord[];
  formVersions: RegistrationFormVersionRecord[];
  selectedFieldIds: string[];
  includeSensitive: boolean;
}

function stringifyAnswer(value: RegistrationAnswerValue | undefined) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "object")) {
      return `${value.length} participant${value.length === 1 ? "" : "s"}`;
    }
    return value.map(String).join(", ");
  }
  return String(value);
}

function uniqueFields(formVersions: RegistrationFormVersionRecord[]) {
  const fields = new Map<string, RegistrationFieldSchema>();
  for (const version of formVersions) {
    for (const field of flattenRegistrationFields(version.sections)) {
      if (!fields.has(field.id)) fields.set(field.id, field);
    }
  }
  return fields;
}

export function resolveExportFields(input: {
  formVersions: RegistrationFormVersionRecord[];
  selectedFieldIds: string[];
  includeSensitive: boolean;
}) {
  const fields = uniqueFields(input.formVersions);
  const requestedIds = input.selectedFieldIds.length > 0
    ? input.selectedFieldIds
    : [...fields.values()].filter((field) => field.includeInExports && !isSensitiveField(field)).map((field) => field.id);

  return requestedIds.map((fieldId) => {
    const field = fields.get(fieldId);
    if (!field) throw new Error(`The selected export field ${fieldId} is not available.`);
    if (isSensitiveField(field) && !input.includeSensitive) {
      throw new Error(`Sensitive field "${field.label}" requires deliberate confirmation.`);
    }
    return field;
  });
}

function wrapText(text: string, maximumCharacters: number) {
  const words = text
    .split(/\s+/)
    .flatMap((word) =>
      word.length > maximumCharacters
        ? Array.from(
            { length: Math.ceil(word.length / maximumCharacters) },
            (_, index) => word.slice(index * maximumCharacters, (index + 1) * maximumCharacters),
          )
        : [word],
    );
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maximumCharacters) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export async function generateRegistrationPdf(input: ReportInput & {
  reportType: RegistrationPdfType;
  orientation: "portrait" | "landscape";
}) {
  const fields = resolveExportFields(input);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size: [number, number] = input.orientation === "landscape" ? [792, 612] : [612, 792];
  const margin = 42;
  const lineHeight = 16;
  let page = pdf.addPage(size);
  let y = size[1] - margin;

  function addPage() {
    page = pdf.addPage(size);
    y = size[1] - margin;
  }

  function line(text: string, options: { bold?: boolean; size?: number; indent?: number } = {}) {
    const fontSize = options.size ?? 10;
    const maximumCharacters = input.orientation === "landscape" ? 115 : 82;
    for (const wrappedLine of wrapText(text, maximumCharacters)) {
      if (y < margin + 30) addPage();
      page.drawText(wrappedLine, {
        x: margin + (options.indent ?? 0),
        y,
        size: fontSize,
        font: options.bold ? bold : font,
        color: rgb(0.08, 0.22, 0.14),
      });
      y -= lineHeight;
    }
  }

  line(input.event.title, { bold: true, size: 18 });
  line(`Host church: ${input.event.churchName}`);
  line(`Event date: ${new Date(input.event.startsAt).toLocaleString("en-US", { timeZone: input.event.timeZone })}`);
  line(`Exported: ${new Date().toLocaleString("en-US")}`);
  line(`Confirmed: ${input.registrations.filter((registration) => registration.status !== "cancelled" && registration.status !== "waitlisted").length} · Waitlisted: ${input.registrations.filter((registration) => registration.status === "waitlisted").length} · Cancelled: ${input.registrations.filter((registration) => registration.status === "cancelled").length}`);
  line(`Capacity: ${input.configuration?.capacity ?? "No limit"} (${input.configuration?.capacityUnit === "registrations" ? "registrations" : "attendees"})`);
  y -= 8;

  input.registrations.forEach((registration, index) => {
    if (y < margin + 120) addPage();
    if (input.reportType === "sign_in" || input.reportType === "check_in") {
      line(`${index + 1}. ${registration.contactName}`, { bold: true });
      line(`Status: ${registration.status} · Confirmation: ${registration.confirmationNumber}`, { indent: 12 });
      if (input.reportType === "sign_in") line("Signature: __________________________________   Arrival: __________", { indent: 12 });
      if (input.reportType === "check_in") line("Checked in: [   ]", { indent: 12 });
    } else {
      line(`${index + 1}. ${registration.contactName} · ${registration.status} · ${registration.attendeeCount} attending`, { bold: true });
      line(`Confirmation: ${registration.confirmationNumber} · Submitted: ${new Date(registration.submittedAt).toLocaleString("en-US")}`, { indent: 12 });
    }
    for (const field of fields) {
      const answer = isSensitiveField(field) && !input.includeSensitive
        ? maskSensitiveValue(registration.answers[field.id])
        : stringifyAnswer(registration.answers[field.id]);
      if (answer) line(`${field.label}: ${answer}`, { indent: 12 });
    }
    y -= 8;
  });

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: size[0] - margin - 70,
      y: 20,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  });

  return Buffer.from(await pdf.save());
}

function safeCellValue(value: unknown) {
  if (value instanceof Date || typeof value === "number" || typeof value === "boolean") return value;
  return neutralizeSpreadsheetFormula(value === null || value === undefined ? "" : String(value));
}

export async function generateRegistrationWorkbook(input: ReportInput) {
  const fields = resolveExportFields(input);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Find Your Church";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Event Summary");
  summary.addRows([
    ["Event", input.event.title],
    ["Church", input.event.churchName],
    ["Date and time", new Date(input.event.startsAt)],
    ["Registration status", input.event.status],
    ["Capacity", input.configuration?.capacity ?? "No limit"],
    ["Capacity counts", input.configuration?.capacityUnit === "registrations" ? "Registration submissions" : "People attending"],
    ["Confirmed registrations", input.registrations.filter((entry) => !["waitlisted", "cancelled"].includes(entry.status)).length],
    ["Waitlist total", input.registrations.filter((entry) => entry.status === "waitlisted").length],
    ["Cancelled total", input.registrations.filter((entry) => entry.status === "cancelled").length],
    ["Export timestamp", new Date()],
  ]);
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 52;
  summary.getColumn(1).font = { bold: true };

  const registrationsSheet = workbook.addWorksheet("Registrations", { views: [{ state: "frozen", ySplit: 1 }] });
  registrationsSheet.columns = [
    { header: "Contact name", key: "contactName", width: 28 },
    { header: "Status", key: "status", width: 16 },
    { header: "Confirmation number", key: "confirmation", width: 22 },
    { header: "Attendee count", key: "attendeeCount", width: 16 },
    { header: "Submitted", key: "submittedAt", width: 22 },
    { header: "Checked in", key: "checkedInAt", width: 22 },
    ...fields.filter((field) => field.type !== "repeating_attendee_group" && field.type !== "repeating_child_group").map((field) => ({ header: field.label, key: field.id, width: Math.min(Math.max(field.label.length + 4, 18), 42) })),
  ];
  input.registrations.forEach((registration) => {
    const row: Record<string, unknown> = {
      contactName: safeCellValue(registration.contactName),
      status: registration.status,
      confirmation: registration.confirmationNumber,
      attendeeCount: registration.attendeeCount,
      submittedAt: new Date(registration.submittedAt),
      checkedInAt: registration.checkedInAt ? new Date(registration.checkedInAt) : "",
    };
    fields.forEach((field) => {
      if (field.type !== "repeating_attendee_group" && field.type !== "repeating_child_group") {
        row[field.id] = safeCellValue(stringifyAnswer(registration.answers[field.id]));
      }
    });
    registrationsSheet.addRow(row);
  });
  registrationsSheet.autoFilter = { from: "A1", to: registrationsSheet.getRow(1).getCell(registrationsSheet.columnCount).address };
  registrationsSheet.getRow(1).font = { bold: true };

  const repeatingFields = fields.filter((field) => field.type === "repeating_attendee_group" || field.type === "repeating_child_group");
  if (repeatingFields.length > 0) {
    const participants = workbook.addWorksheet("Participants", { views: [{ state: "frozen", ySplit: 1 }] });
    const participantFieldMap = new Map<string, RegistrationFieldSchema>();
    repeatingFields.forEach((field) => field.participantFields?.forEach((participantField) => participantFieldMap.set(participantField.id, participantField)));
    participants.columns = [
      { header: "Parent registration", key: "confirmation", width: 22 },
      { header: "Contact name", key: "contactName", width: 28 },
      { header: "Group", key: "group", width: 22 },
      ...[...participantFieldMap.values()].map((field) => ({ header: field.label, key: field.id, width: 24 })),
    ];
    input.registrations.forEach((registration) => repeatingFields.forEach((groupField) => {
      const records = registration.answers[groupField.id];
      if (!Array.isArray(records)) return;
      records.forEach((record) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) return;
        const row: Record<string, unknown> = { confirmation: registration.confirmationNumber, contactName: safeCellValue(registration.contactName), group: groupField.label };
        Object.entries(record).forEach(([key, value]) => { row[key] = safeCellValue(Array.isArray(value) ? value.join(", ") : value); });
        participants.addRow(row);
      });
    }));
    participants.autoFilter = { from: "A1", to: participants.getRow(1).getCell(participants.columnCount).address };
    participants.getRow(1).font = { bold: true };
  }

  const summaryFields = fields.filter((field) => ["dropdown", "radio", "multiple_checkboxes", "multi_select", "yes_no"].includes(field.type));
  if (summaryFields.length > 0) {
    const answerSummary = workbook.addWorksheet("Answer Summary", { views: [{ state: "frozen", ySplit: 1 }] });
    answerSummary.columns = [{ header: "Question", key: "question", width: 38 }, { header: "Answer", key: "answer", width: 30 }, { header: "Count", key: "count", width: 12 }];
    summaryFields.forEach((field) => {
      const counts = new Map<string, number>();
      input.registrations.forEach((registration) => {
        const value = registration.answers[field.id];
        const values = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
        values.forEach((answer) => counts.set(answer, (counts.get(answer) ?? 0) + 1));
      });
      counts.forEach((count, answer) => answerSummary.addRow({ question: safeCellValue(field.label), answer: safeCellValue(answer), count }));
    });
    answerSummary.autoFilter = { from: "A1", to: "C1" };
    answerSummary.getRow(1).font = { bold: true };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
