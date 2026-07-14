import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";

import { siteConfig } from "@/lib/config/site";
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
    : [...fields.values()]
        .filter((field) => field.includeInExports && !isSensitiveField(field))
        .map((field) => field.id);

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
  pdf.setTitle(`${input.event.title} - ${input.reportType.replaceAll("_", " ")}`);
  pdf.setAuthor(siteConfig.ministryName);
  pdf.setCreator(siteConfig.launchName);
  pdf.setProducer(siteConfig.launchName);
  pdf.setSubject(`Registration report provided through ${siteConfig.launchName}.`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size: [number, number] = input.orientation === "landscape" ? [792, 612] : [612, 792];
  const margin = 42;
  const lineHeight = 15;
  const colors: Record<string, RGB> = {
    darkGreen: rgb(0.024, 0.22, 0.11),
    deepGreen: rgb(0.043, 0.29, 0.14),
    gold: rgb(0.85, 0.64, 0.11),
    cream: rgb(0.969, 0.961, 0.937),
    ink: rgb(0.09, 0.16, 0.11),
    muted: rgb(0.34, 0.39, 0.35),
    white: rgb(1, 1, 1),
    border: rgb(0.82, 0.86, 0.82),
  };
  const reportTypeLabel = input.reportType === "sign_in"
    ? "Sign-in sheet"
    : input.reportType === "check_in"
      ? "Check-in sheet"
      : "Registration roster";
  let page = pdf.addPage(size);
  let y = 0;

  function drawPageHeader(isFirstPage: boolean) {
    const pageHeight = size[1];
    page.drawRectangle({
      x: 0,
      y: pageHeight - 66,
      width: size[0],
      height: 66,
      color: colors.darkGreen,
    });
    page.drawRectangle({
      x: 0,
      y: pageHeight - 69,
      width: size[0],
      height: 3,
      color: colors.gold,
    });
    page.drawText("FIND YOUR CHURCH PALACIOS", {
      x: margin,
      y: pageHeight - 31,
      size: 14,
      font: bold,
      color: colors.white,
    });
    page.drawText(
      isFirstPage ? reportTypeLabel.toUpperCase() : `${reportTypeLabel.toUpperCase()} - CONTINUED`,
      {
        x: margin,
        y: pageHeight - 49,
        size: 8,
        font: bold,
        color: colors.gold,
      },
    );
    y = pageHeight - 94;
  }

  function addPage() {
    page = pdf.addPage(size);
    drawPageHeader(false);
  }

  function line(
    text: string,
    options: {
      bold?: boolean;
      size?: number;
      indent?: number;
      color?: RGB;
      gapAfter?: number;
    } = {},
  ) {
    const fontSize = options.size ?? 10;
    const maximumCharacters = input.orientation === "landscape" ? 115 : 82;
    for (const wrappedLine of wrapText(text, maximumCharacters)) {
      if (y < 88) addPage();
      page.drawText(wrappedLine, {
        x: margin + (options.indent ?? 0),
        y,
        size: fontSize,
        font: options.bold ? bold : font,
        color: options.color ?? colors.ink,
      });
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 0;
  }

  drawPageHeader(true);

  const confirmedTotal = input.registrations.filter(
    (registration) => registration.status !== "cancelled" && registration.status !== "waitlisted",
  ).length;
  const waitlistedTotal = input.registrations.filter(
    (registration) => registration.status === "waitlisted",
  ).length;
  const cancelledTotal = input.registrations.filter(
    (registration) => registration.status === "cancelled",
  ).length;

  line(input.event.title, { bold: true, size: 20, color: colors.darkGreen, gapAfter: 4 });
  line(`Hosted by ${input.event.churchName}`, { bold: true, color: colors.deepGreen });
  line(
    `Event date: ${new Date(input.event.startsAt).toLocaleString("en-US", {
      timeZone: input.event.timeZone,
    })}`,
    { color: colors.muted },
  );
  line(`Exported: ${new Date().toLocaleString("en-US")}`, { color: colors.muted, gapAfter: 8 });

  const summaryTop = y + 5;
  const summaryHeight = 50;
  page.drawRectangle({
    x: margin,
    y: summaryTop - summaryHeight,
    width: size[0] - margin * 2,
    height: summaryHeight,
    color: colors.cream,
    borderColor: colors.border,
    borderWidth: 0.75,
  });
  const summaryItems = [
    ["CONFIRMED", String(confirmedTotal)],
    ["WAITLISTED", String(waitlistedTotal)],
    ["CANCELLED", String(cancelledTotal)],
    ["CAPACITY", String(input.configuration?.capacity ?? "No limit")],
  ];
  const summaryWidth = (size[0] - margin * 2) / summaryItems.length;
  summaryItems.forEach(([label, value], index) => {
    const x = margin + summaryWidth * index;
    if (index > 0) {
      page.drawLine({
        start: { x, y: summaryTop - 40 },
        end: { x, y: summaryTop - 10 },
        thickness: 0.6,
        color: colors.border,
      });
    }
    page.drawText(label, {
      x: x + 10,
      y: summaryTop - 17,
      size: 7.5,
      font: bold,
      color: colors.muted,
    });
    page.drawText(value, {
      x: x + 10,
      y: summaryTop - 37,
      size: 14,
      font: bold,
      color: colors.deepGreen,
    });
  });
  y = summaryTop - summaryHeight - 20;
  line(
    input.includeSensitive
      ? "Confidential export: sensitive fields were deliberately included. Store and share this report securely."
      : "Privacy-aware export: sensitive registration fields are excluded unless deliberately requested.",
    { size: 8.5, color: colors.muted, gapAfter: 7 },
  );

  input.registrations.forEach((registration, index) => {
    if (y < 150) addPage();
    page.drawLine({
      start: { x: margin, y: y + 7 },
      end: { x: size[0] - margin, y: y + 7 },
      thickness: 0.6,
      color: colors.border,
    });
    if (input.reportType === "sign_in" || input.reportType === "check_in") {
      line(`${index + 1}. ${registration.contactName}`, { bold: true, color: colors.darkGreen });
      line(`Status: ${registration.status} | Confirmation: ${registration.confirmationNumber}`, {
        indent: 12,
        color: colors.muted,
      });
      if (input.reportType === "sign_in") {
        line("Signature: __________________________________   Arrival: __________", { indent: 12 });
      }
      if (input.reportType === "check_in") line("Checked in: [   ]", { indent: 12 });
    } else {
      line(
        `${index + 1}. ${registration.contactName} | ${registration.status} | ${registration.attendeeCount} attending`,
        { bold: true, color: colors.darkGreen },
      );
      line(
        `Confirmation: ${registration.confirmationNumber} | Submitted: ${new Date(registration.submittedAt).toLocaleString("en-US")}`,
        { indent: 12, color: colors.muted },
      );
    }
    for (const field of fields) {
      const answer = isSensitiveField(field) && !input.includeSensitive
        ? maskSensitiveValue(registration.answers[field.id])
        : stringifyAnswer(registration.answers[field.id]);
      if (answer) line(`${field.label}: ${answer}`, { indent: 12 });
    }
    y -= 9;
  });

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawLine({
      start: { x: margin, y: 55 },
      end: { x: size[0] - margin, y: 55 },
      thickness: 0.6,
      color: colors.border,
    });
    pdfPage.drawText(
      `${siteConfig.launchName} is provided free of charge by ${siteConfig.ministryName}.`,
      { x: margin, y: 39, size: 7.5, font: bold, color: colors.deepGreen },
    );
    pdfPage.drawText(`Support this ministry: ${siteConfig.ministryDonationUrl}`, {
      x: margin,
      y: 26,
      size: 7.5,
      font,
      color: colors.muted,
    });
    pdfPage.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: size[0] - margin - 70,
      y: 30,
      size: 8,
      font,
      color: colors.muted,
    });
  });

  return Buffer.from(await pdf.save());
}

function safeCellValue(value: unknown) {
  if (value instanceof Date || typeof value === "number" || typeof value === "boolean") return value;
  return neutralizeSpreadsheetFormula(value === null || value === undefined ? "" : String(value));
}

const workbookBrand = {
  darkGreen: "06381C",
  deepGreen: "0B4A24",
  gold: "D9A21B",
  cream: "F7F5EF",
  sage: "EDF1E9",
  white: "FFFFFF",
  border: "D5DDD4",
};

function styleWorkbookDataSheet(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { bold: true, color: { argb: workbookBrand.white }, size: 11 };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: workbookBrand.deepGreen },
  };
  headerRow.border = { bottom: { style: "medium", color: { argb: workbookBrand.gold } } };

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 24;
    row.alignment = { vertical: "middle", wrapText: true };
    if (rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: workbookBrand.sage } };
    }
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: workbookBrand.border } } };
    });
  }

  worksheet.properties.defaultRowHeight = 22;
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter.oddFooter =
    `&L${siteConfig.launchName} - provided free by ${siteConfig.ministryName}&RPage &P of &N`;
  worksheet.headerFooter.evenFooter = worksheet.headerFooter.oddFooter;
}

export async function generateRegistrationWorkbook(input: ReportInput) {
  const fields = resolveExportFields(input);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${siteConfig.launchName} / ${siteConfig.ministryName}`;
  workbook.company = siteConfig.ministryName;
  workbook.title = `${input.event.title} registration workbook`;
  workbook.subject = `Registration report for ${input.event.title}`;
  workbook.description = `${siteConfig.launchName} is provided free of charge by ${siteConfig.ministryName}.`;
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Event Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: workbookBrand.gold } },
  });
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
    ["Provided by", `${siteConfig.launchName} / ${siteConfig.ministryName}`],
    ["Ministry support", siteConfig.ministryDonationUrl],
  ]);
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 52;
  summary.getColumn(1).font = { bold: true, color: { argb: workbookBrand.deepGreen } };
  summary.getColumn(2).alignment = { wrapText: true, vertical: "middle" };
  summary.getRow(1).height = 34;
  summary.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: workbookBrand.darkGreen },
  };
  summary.getRow(1).font = { bold: true, color: { argb: workbookBrand.white }, size: 13 };
  summary.getRow(1).getCell(2).font = { bold: true, color: { argb: workbookBrand.gold }, size: 13 };
  summary.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 34 : 25;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: workbookBrand.border } } };
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: workbookBrand.cream } };
      }
    });
  });
  summary.getCell("B12").value = {
    text: siteConfig.ministryDonationUrl,
    hyperlink: siteConfig.ministryDonationUrl,
    tooltip: "Support El Roi Digital Ministries",
  };
  summary.getCell("B12").font = { color: { argb: workbookBrand.deepGreen }, underline: true };
  summary.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  summary.headerFooter.oddFooter =
    `&LProvided free of charge by ${siteConfig.ministryName}&RPage &P of &N`;

  const registrationsSheet = workbook.addWorksheet("Registrations", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: workbookBrand.deepGreen } },
  });
  registrationsSheet.columns = [
    { header: "Contact name", key: "contactName", width: 28 },
    { header: "Status", key: "status", width: 16 },
    { header: "Confirmation number", key: "confirmation", width: 22 },
    { header: "Attendee count", key: "attendeeCount", width: 16 },
    { header: "Submitted", key: "submittedAt", width: 22 },
    { header: "Checked in", key: "checkedInAt", width: 22 },
    ...fields
      .filter((field) => field.type !== "repeating_attendee_group" && field.type !== "repeating_child_group")
      .map((field) => ({
        header: field.label,
        key: field.id,
        width: Math.min(Math.max(field.label.length + 4, 18), 42),
      })),
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
  registrationsSheet.autoFilter = {
    from: "A1",
    to: registrationsSheet.getRow(1).getCell(registrationsSheet.columnCount).address,
  };
  styleWorkbookDataSheet(registrationsSheet);

  const repeatingFields = fields.filter(
    (field) => field.type === "repeating_attendee_group" || field.type === "repeating_child_group",
  );
  if (repeatingFields.length > 0) {
    const participants = workbook.addWorksheet("Participants", {
      views: [{ state: "frozen", ySplit: 1 }],
      properties: { tabColor: { argb: workbookBrand.deepGreen } },
    });
    const participantFieldMap = new Map<string, RegistrationFieldSchema>();
    repeatingFields.forEach((field) =>
      field.participantFields?.forEach((participantField) =>
        participantFieldMap.set(participantField.id, participantField),
      ),
    );
    participants.columns = [
      { header: "Parent registration", key: "confirmation", width: 22 },
      { header: "Contact name", key: "contactName", width: 28 },
      { header: "Group", key: "group", width: 22 },
      ...[...participantFieldMap.values()].map((field) => ({
        header: field.label,
        key: field.id,
        width: 24,
      })),
    ];
    input.registrations.forEach((registration) =>
      repeatingFields.forEach((groupField) => {
        const records = registration.answers[groupField.id];
        if (!Array.isArray(records)) return;
        records.forEach((record) => {
          if (!record || typeof record !== "object" || Array.isArray(record)) return;
          const row: Record<string, unknown> = {
            confirmation: registration.confirmationNumber,
            contactName: safeCellValue(registration.contactName),
            group: groupField.label,
          };
          Object.entries(record).forEach(([key, value]) => {
            row[key] = safeCellValue(Array.isArray(value) ? value.join(", ") : value);
          });
          participants.addRow(row);
        });
      }),
    );
    participants.autoFilter = {
      from: "A1",
      to: participants.getRow(1).getCell(participants.columnCount).address,
    };
    styleWorkbookDataSheet(participants);
  }

  const summaryFields = fields.filter((field) =>
    ["dropdown", "radio", "multiple_checkboxes", "multi_select", "yes_no"].includes(field.type),
  );
  if (summaryFields.length > 0) {
    const answerSummary = workbook.addWorksheet("Answer Summary", {
      views: [{ state: "frozen", ySplit: 1 }],
      properties: { tabColor: { argb: workbookBrand.deepGreen } },
    });
    answerSummary.columns = [
      { header: "Question", key: "question", width: 38 },
      { header: "Answer", key: "answer", width: 30 },
      { header: "Count", key: "count", width: 12 },
    ];
    summaryFields.forEach((field) => {
      const counts = new Map<string, number>();
      input.registrations.forEach((registration) => {
        const value = registration.answers[field.id];
        const values = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
        values.forEach((answer) => counts.set(answer, (counts.get(answer) ?? 0) + 1));
      });
      counts.forEach((count, answer) =>
        answerSummary.addRow({
          question: safeCellValue(field.label),
          answer: safeCellValue(answer),
          count,
        }),
      );
    });
    answerSummary.autoFilter = { from: "A1", to: "C1" };
    styleWorkbookDataSheet(answerSummary);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
