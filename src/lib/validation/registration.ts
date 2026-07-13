import { z } from "zod";

import {
  conditionIsMet,
  flattenRegistrationFields,
  isProhibitedRegistrationQuestion,
} from "@/lib/registration-utils";
import {
  registrationFieldTypes,
  sensitiveDataClassifications,
  type EventRegistrationConfigurationRecord,
  type RegistrationAnswerValue,
  type RegistrationFieldSchema,
  type RegistrationFormSection,
} from "@/lib/types/registrations";

const identifierPattern = /^[a-zA-Z0-9_-]{3,80}$/;
const optionValuePattern = /^[a-zA-Z0-9 _.'()&/+:-]{1,120}$/;
const maximumAnswerPayloadBytes = 150 * 1024;

const optionSchema = z.object({
  id: z.string().regex(identifierPattern),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().regex(optionValuePattern),
});

const conditionSchema = z.object({
  sourceFieldId: z.string().regex(identifierPattern),
  operator: z.enum(["equals", "checked", "greater_than"]),
  value: z.union([z.string().max(120), z.number(), z.boolean()]).optional(),
});

const baseFieldSchema: z.ZodType<RegistrationFieldSchema> = z.lazy(() =>
  z.object({
    id: z.string().regex(identifierPattern),
    type: z.enum(registrationFieldTypes),
    label: z.string().trim().min(1).max(160),
    helpText: z.string().trim().max(500).optional(),
    placeholder: z.string().trim().max(160).optional(),
    required: z.boolean(),
    options: z.array(optionSchema).max(40),
    minValue: z.number().finite().nullable().optional(),
    maxValue: z.number().finite().nullable().optional(),
    minSelections: z.number().int().min(0).max(40).nullable().optional(),
    maxSelections: z.number().int().min(1).max(40).nullable().optional(),
    minLength: z.number().int().min(0).max(5000).nullable().optional(),
    maxLength: z.number().int().min(1).max(5000).nullable().optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional(),
    displayOrder: z.number().int().min(0).max(1000),
    includeInExports: z.boolean(),
    sensitiveClassification: z.enum(sensitiveDataClassifications),
    condition: conditionSchema.nullable().optional(),
    organizerExplanation: z.string().trim().max(500).optional(),
    participantFields: z.array(baseFieldSchema).max(30).optional(),
  }),
);

const sectionSchema = z.object({
  id: z.string().regex(identifierPattern),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  displayOrder: z.number().int().min(0).max(1000),
  fields: z.array(baseFieldSchema).min(1).max(100),
});

const registrationConfigurationSchema = z.object({
  mode: z.enum(["none", "simple_rsvp", "internal_custom", "google_forms", "external"]),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  capacityUnit: z.enum(["registrations", "attendees"]),
  maximumAttendeesPerRegistration: z.number().int().min(1).max(100),
  waitlistEnabled: z.boolean(),
  waitlistCapacity: z.number().int().min(1).max(100000).nullable().optional(),
  automaticWaitlistPromotion: z.boolean(),
  allowRegistrantEditing: z.boolean(),
  allowRegistrantCancellation: z.boolean(),
  showCapacityStatus: z.boolean(),
  confirmationEmailEnabled: z.boolean(),
  reminderEmailEnabled: z.boolean(),
  organizerNewRegistrationEmail: z.boolean(),
  organizerDailyDigestEmail: z.boolean(),
  registrationClosingReportEnabled: z.boolean(),
  preEventReportEnabled: z.boolean(),
  scheduledReportFormats: z.array(z.enum(["pdf", "xlsx"])).max(2),
  successMessage: z.string().trim().min(1).max(1000),
  closedMessage: z.string().trim().min(1).max(1000),
  waitlistMessage: z.string().trim().min(1).max(1000),
  consentText: z.string().trim().max(3000).nullable().optional(),
  retentionDays: z.number().int().min(30).max(730),
});

function assertNoDuplicateIds(sections: RegistrationFormSection[]) {
  const ids = new Set<string>();

  for (const section of sections) {
    if (ids.has(section.id)) {
      throw new Error(`Duplicate form identifier: ${section.id}.`);
    }
    ids.add(section.id);

    for (const field of section.fields) {
      if (ids.has(field.id)) {
        throw new Error(`Duplicate form identifier: ${field.id}.`);
      }
      ids.add(field.id);

      for (const participantField of field.participantFields ?? []) {
        const participantId = `${field.id}.${participantField.id}`;
        if (ids.has(participantId)) {
          throw new Error(`Duplicate participant field identifier: ${participantId}.`);
        }
        ids.add(participantId);
      }
    }
  }
}

function assertValidOptions(field: RegistrationFieldSchema) {
  const optionFieldTypes = new Set([
    "dropdown",
    "radio",
    "multiple_checkboxes",
    "multi_select",
  ]);

  if (optionFieldTypes.has(field.type) && field.options.length < 1) {
    throw new Error(`${field.label} needs at least one option.`);
  }

  const optionValues = new Set<string>();
  for (const option of field.options) {
    if (optionValues.has(option.value)) {
      throw new Error(`${field.label} contains a duplicate option value.`);
    }
    optionValues.add(option.value);
  }

  if (
    (field.type === "repeating_attendee_group" || field.type === "repeating_child_group") &&
    (!field.participantFields || field.participantFields.length === 0)
  ) {
    throw new Error(`${field.label} needs at least one participant field.`);
  }

  if (
    field.participantFields?.some(
      (participantField) =>
        participantField.type === "repeating_attendee_group" ||
        participantField.type === "repeating_child_group",
    )
  ) {
    throw new Error(`${field.label} cannot contain another repeating group.`);
  }
}

function assertValidConditions(fields: RegistrationFieldSchema[]) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));

  for (const field of fields) {
    if (field.condition && !fieldMap.has(field.condition.sourceFieldId)) {
      throw new Error(`${field.label} has a condition that references a missing field.`);
    }

    if (field.condition?.sourceFieldId === field.id) {
      throw new Error(`${field.label} cannot depend on itself.`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(fieldId: string) {
    if (visiting.has(fieldId)) {
      throw new Error("Conditional field rules contain a loop.");
    }
    if (visited.has(fieldId)) {
      return;
    }

    visiting.add(fieldId);
    const dependency = fieldMap.get(fieldId)?.condition?.sourceFieldId;
    if (dependency) {
      visit(dependency);
    }
    visiting.delete(fieldId);
    visited.add(fieldId);
  }

  for (const field of fields) {
    visit(field.id);
  }
}

export function validateRegistrationFormSections(input: unknown) {
  const parsedSections = z.array(sectionSchema).min(1).max(20).parse(input);
  const fields = flattenRegistrationFields(parsedSections);

  if (fields.length > 100) {
    throw new Error("Registration forms may contain at most 100 top-level fields.");
  }

  assertNoDuplicateIds(parsedSections);
  assertValidConditions(fields);

  for (const field of fields) {
    assertValidOptions(field);

    if (isProhibitedRegistrationQuestion(field)) {
      throw new Error(`The field "${field.label}" requests information this platform does not permit.`);
    }

    if (field.minValue !== null && field.maxValue !== null &&
      field.minValue !== undefined && field.maxValue !== undefined &&
      field.minValue > field.maxValue) {
      throw new Error(`${field.label} has an invalid numeric range.`);
    }

    if (field.participantFields?.length) {
      assertValidConditions(field.participantFields);
      for (const participantField of field.participantFields) {
        assertValidOptions(participantField);
        if (isProhibitedRegistrationQuestion(participantField)) {
          throw new Error(`The field "${participantField.label}" requests information this platform does not permit.`);
        }
      }
    }
  }

  return parsedSections;
}

export function validateRegistrationConfiguration(input: unknown, event: { startsAt: string; endsAt?: string | null }) {
  const parsed = registrationConfigurationSchema.parse(input);
  const eventEnd = new Date(event.endsAt ?? event.startsAt).getTime();

  if (parsed.opensAt && parsed.closesAt && new Date(parsed.opensAt) >= new Date(parsed.closesAt)) {
    throw new Error("Registration must open before it closes.");
  }

  if (parsed.closesAt && new Date(parsed.closesAt).getTime() > eventEnd) {
    throw new Error("Registration must close no later than the event ends.");
  }

  if (parsed.waitlistEnabled && parsed.waitlistCapacity === null) {
    throw new Error("Add a waitlist capacity or turn off the waitlist.");
  }

  if (
    (parsed.registrationClosingReportEnabled || parsed.preEventReportEnabled) &&
    parsed.scheduledReportFormats.length === 0
  ) {
    throw new Error("Choose PDF, Excel, or both for scheduled registration reports.");
  }

  return parsed;
}

function normalizeText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maximumLength);
}

function validateSingleValue(field: RegistrationFieldSchema, value: unknown): RegistrationAnswerValue {
  const maximumLength = field.maxLength ?? (field.type === "long_text" ? 2000 : 500);

  if (typeof value === "string") {
    const sanitizedValue = value
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim();
    if (sanitizedValue.length > maximumLength) {
      throw new Error(`${field.label} must contain no more than ${maximumLength} characters.`);
    }
  }

  if (field.type === "single_checkbox" || field.type === "consent") {
    return value === true || value === "true" || value === "on";
  }

  if (field.type === "yes_no") {
    if (value !== "yes" && value !== "no") {
      return null;
    }
    return value;
  }

  if (field.type === "number") {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`${field.label} must be a number.`);
    }
    if (field.minValue !== null && field.minValue !== undefined && numericValue < field.minValue) {
      throw new Error(`${field.label} must be at least ${field.minValue}.`);
    }
    if (field.maxValue !== null && field.maxValue !== undefined && numericValue > field.maxValue) {
      throw new Error(`${field.label} must be no more than ${field.maxValue}.`);
    }
    return numericValue;
  }

  if (field.type === "multiple_checkboxes" || field.type === "multi_select") {
    const values = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    const validOptions = new Set(field.options.map((option) => option.value));
    if (values.some((entry) => !validOptions.has(entry))) {
      throw new Error(`${field.label} contains an invalid selection.`);
    }
    if (field.minSelections !== null && field.minSelections !== undefined && values.length < field.minSelections) {
      throw new Error(`${field.label} needs at least ${field.minSelections} selections.`);
    }
    if (field.maxSelections !== null && field.maxSelections !== undefined && values.length > field.maxSelections) {
      throw new Error(`${field.label} allows no more than ${field.maxSelections} selections.`);
    }
    return values;
  }

  if (field.type === "dropdown" || field.type === "radio") {
    const textValue = normalizeText(value, maximumLength);
    if (textValue && !field.options.some((option) => option.value === textValue)) {
      throw new Error(`${field.label} contains an invalid selection.`);
    }
    return textValue;
  }

  if (field.type === "repeating_attendee_group" || field.type === "repeating_child_group") {
    const records = Array.isArray(value) ? value : [];
    const maximumRecords = field.maxValue ?? 25;
    if (records.length > maximumRecords) {
      throw new Error(`${field.label} allows no more than ${maximumRecords} entries.`);
    }

    return records.map((record, index) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error(`${field.label} entry ${index + 1} is invalid.`);
      }

      const normalizedRecord: Record<string, string | number | boolean | string[]> = {};
      const participantFields = field.participantFields ?? [];
      const participantFieldMap = new Map(
        participantFields.map((participantField) => [participantField.id, participantField]),
      );
      const resolvedVisibility = new Map<string, boolean>();
      const resolving = new Set<string>();

      const resolveParticipantField = (participantField: RegistrationFieldSchema): boolean => {
        const existingVisibility = resolvedVisibility.get(participantField.id);
        if (existingVisibility !== undefined) {
          return existingVisibility;
        }
        if (resolving.has(participantField.id)) {
          throw new Error(`${field.label} contains a conditional-field loop.`);
        }

        resolving.add(participantField.id);
        let visible = true;
        if (participantField.condition) {
          const sourceField = participantFieldMap.get(participantField.condition.sourceFieldId);
          visible = Boolean(
            sourceField &&
              resolveParticipantField(sourceField) &&
              conditionIsMet(participantField.condition, normalizedRecord),
          );
        }

        if (visible) {
          const participantValue = validateSingleValue(
            participantField,
            (record as Record<string, unknown>)[participantField.id],
          );
          const isEmpty = participantValue === null || participantValue === "" ||
            (Array.isArray(participantValue) && participantValue.length === 0) ||
            participantValue === false;
          if (participantField.required && isEmpty) {
            throw new Error(`${participantField.label} is required for ${field.label} entry ${index + 1}.`);
          }
          if (participantValue !== null && !Array.isArray(participantValue)) {
            normalizedRecord[participantField.id] = participantValue;
          } else if (
            Array.isArray(participantValue) &&
            participantValue.every((entry) => typeof entry === "string")
          ) {
            normalizedRecord[participantField.id] = participantValue as string[];
          }
        }

        resolving.delete(participantField.id);
        resolvedVisibility.set(participantField.id, visible);
        return visible;
      };

      for (const participantField of participantFields) {
        resolveParticipantField(participantField);
      }
      return normalizedRecord;
    });
  }

  const textValue = normalizeText(value, maximumLength);
  if (textValue && field.minLength && textValue.length < field.minLength) {
    throw new Error(`${field.label} must contain at least ${field.minLength} characters.`);
  }
  if (field.type === "email" && textValue && !z.string().email().safeParse(textValue).success) {
    throw new Error(`${field.label} must be a valid email address.`);
  }
  if (field.type === "date" && textValue && !/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
    throw new Error(`${field.label} must be a valid date.`);
  }
  return textValue;
}

export function parseRegistrationAnswerPayload(payload: string) {
  if (Buffer.byteLength(payload, "utf8") > maximumAnswerPayloadBytes) {
    throw new Error("The registration response is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("The registration response could not be read.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The registration response is invalid.");
  }

  return parsed as Record<string, unknown>;
}

export function validateRegistrationAnswers(input: {
  sections: RegistrationFormSection[];
  answers: Record<string, unknown>;
  maximumAttendeesPerRegistration: number;
}) {
  const fields = flattenRegistrationFields(input.sections);
  const normalizedAnswers: Record<string, RegistrationAnswerValue> = {};
  const answerLabels: Record<string, string> = {};
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const resolvedVisibility = new Map<string, boolean>();
  const resolving = new Set<string>();

  const resolveField = (field: RegistrationFieldSchema): boolean => {
    const existingVisibility = resolvedVisibility.get(field.id);
    if (existingVisibility !== undefined) {
      return existingVisibility;
    }
    if (resolving.has(field.id)) {
      throw new Error("Conditional field rules contain a loop.");
    }

    resolving.add(field.id);
    let visible = true;
    if (field.condition) {
      const sourceField = fieldMap.get(field.condition.sourceFieldId);
      visible = Boolean(
        sourceField &&
          resolveField(sourceField) &&
          conditionIsMet(field.condition, normalizedAnswers),
      );
    }

    if (
      visible &&
      field.type !== "section_heading" &&
      field.type !== "informational_text"
    ) {
      const normalizedValue = validateSingleValue(field, input.answers[field.id]);
      const isEmpty = normalizedValue === null || normalizedValue === "" ||
        (Array.isArray(normalizedValue) && normalizedValue.length === 0) ||
        normalizedValue === false;

      if (field.required && isEmpty) {
        throw new Error(`${field.label} is required.`);
      }

      normalizedAnswers[field.id] = normalizedValue;
      answerLabels[field.id] = field.label;
    }

    resolving.delete(field.id);
    resolvedVisibility.set(field.id, visible);
    return visible;
  };

  for (const field of fields) {
    resolveField(field);
  }

  const findFirstText = (types: RegistrationFieldSchema["type"][]) => {
    const field = fields.find((candidate) => types.includes(candidate.type));
    const value = field ? normalizedAnswers[field.id] : null;
    return typeof value === "string" ? value : null;
  };
  const firstName = findFirstText(["first_name"]);
  const lastName = findFirstText(["last_name"]);
  const contactName =
    findFirstText(["full_name"]) ??
    [firstName, lastName].filter(Boolean).join(" ") ??
    "Registrant";
  const contactEmail = findFirstText(["email"]);
  const contactPhone = findFirstText(["phone"]);
  const attendeeCountField = fields.find((field) => field.id === "attendee_count");
  const repeatingField = fields.find(
    (field) => field.type === "repeating_attendee_group" || field.type === "repeating_child_group",
  );
  const repeatingValue = repeatingField ? normalizedAnswers[repeatingField.id] : null;
  const attendeeCount = attendeeCountField && typeof normalizedAnswers[attendeeCountField.id] === "number"
    ? Number(normalizedAnswers[attendeeCountField.id])
    : Array.isArray(repeatingValue)
      ? repeatingValue.length
      : 1;

  if (attendeeCount < 1 || attendeeCount > input.maximumAttendeesPerRegistration) {
    throw new Error(`Each registration may include between 1 and ${input.maximumAttendeesPerRegistration} attendees.`);
  }

  return {
    answers: normalizedAnswers,
    answerLabels,
    contactName: contactName || "Registrant",
    contactEmail,
    contactPhone,
    attendeeCount,
  };
}

export function getDefaultRegistrationConfiguration(input: {
  eventId: string;
  churchId: string;
  mode: EventRegistrationConfigurationRecord["mode"];
  actorUserId: string;
  opensAt?: string | null;
  closesAt?: string | null;
  capacity?: number | null;
  now?: string;
}): EventRegistrationConfigurationRecord {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.eventId,
    eventId: input.eventId,
    churchId: input.churchId,
    mode: input.mode,
    activeFormVersionId: null,
    draftFormVersionId: null,
    opensAt: input.opensAt ?? null,
    closesAt: input.closesAt ?? null,
    capacity: input.capacity ?? null,
    capacityUnit: "attendees",
    maximumAttendeesPerRegistration: 10,
    waitlistEnabled: false,
    waitlistCapacity: null,
    automaticWaitlistPromotion: false,
    allowRegistrantEditing: true,
    allowRegistrantCancellation: true,
    showCapacityStatus: true,
    confirmationEmailEnabled: true,
    reminderEmailEnabled: false,
    organizerNewRegistrationEmail: true,
    organizerDailyDigestEmail: false,
    registrationClosingReportEnabled: false,
    preEventReportEnabled: false,
    scheduledReportFormats: ["pdf"],
    successMessage: "Your registration has been received.",
    closedMessage: "Registration is closed for this event.",
    waitlistMessage: "The event is full, but your place on the waitlist has been saved.",
    consentText: null,
    retentionDays: 180,
    createdAt: now,
    updatedAt: now,
    updatedByUserId: input.actorUserId,
  };
}
