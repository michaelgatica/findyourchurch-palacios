import assert from "node:assert/strict";

import { registrationPresets } from "@/lib/data/registration-presets";
import {
  createRegistrationChallenge,
  createRegistrationSearchPrefixes,
  createSchemaFingerprint,
  isSensitiveField,
  neutralizeSpreadsheetFormula,
  verifyRegistrationChallenge,
} from "@/lib/registration-utils";
import type {
  RegistrationAnswerValue,
  RegistrationFieldSchema,
  RegistrationFieldType,
  RegistrationFormSection,
} from "@/lib/types/registrations";
import { validateExternalRegistrationUrl } from "@/lib/validation/external-registration-url";
import {
  getDefaultRegistrationConfiguration,
  parseRegistrationAnswerPayload,
  validateRegistrationAnswers,
  validateRegistrationConfiguration,
  validateRegistrationFormSections,
} from "@/lib/validation/registration";

function field(
  id: string,
  type: RegistrationFieldType,
  displayOrder: number,
  overrides: Partial<RegistrationFieldSchema> = {},
): RegistrationFieldSchema {
  return {
    id,
    type,
    label: overrides.label ?? id.replaceAll("_", " "),
    helpText: overrides.helpText,
    placeholder: overrides.placeholder,
    required: overrides.required ?? false,
    options: overrides.options ?? [],
    minValue: overrides.minValue ?? null,
    maxValue: overrides.maxValue ?? null,
    minSelections: overrides.minSelections ?? null,
    maxSelections: overrides.maxSelections ?? null,
    minLength: overrides.minLength ?? null,
    maxLength: overrides.maxLength ?? null,
    defaultValue: overrides.defaultValue ?? null,
    displayOrder,
    includeInExports: overrides.includeInExports ?? true,
    sensitiveClassification: overrides.sensitiveClassification ?? "none",
    condition: overrides.condition ?? null,
    organizerExplanation: overrides.organizerExplanation,
    participantFields: overrides.participantFields,
  };
}

function section(fields: RegistrationFieldSchema[]): RegistrationFormSection[] {
  return [{ id: "section-main", title: "Registration", displayOrder: 0, fields }];
}

function expectThrows(callback: () => unknown, pattern: RegExp) {
  assert.throws(callback, pattern);
}

async function run() {
  process.env.REGISTRATION_TOKEN_SECRET = "test-only-registration-secret";

  const optionValues = [
    { id: "option-one", label: "One", value: "one" },
    { id: "option-two", label: "Two", value: "two" },
  ];
  const participantFields = [
    field("participant_name", "full_name", 0, { required: true, label: "Participant name" }),
    field("participant_age", "number", 1, { minValue: 1, maxValue: 120, label: "Participant age" }),
  ];
  const fields: RegistrationFieldSchema[] = [
    field("heading_field", "section_heading", 0),
    field("information_field", "informational_text", 1),
    field("first_name_field", "first_name", 2, { required: true }),
    field("last_name_field", "last_name", 3, { required: true }),
    field("full_name_field", "full_name", 4),
    field("short_text_field", "short_text", 5, { maxLength: 40 }),
    field("long_text_field", "long_text", 6, { maxLength: 200 }),
    field("email_field", "email", 7),
    field("phone_field", "phone", 8),
    field("number_field", "number", 9, { minValue: 1, maxValue: 10 }),
    field("date_field", "date", 10),
    field("street_field", "street_address", 11),
    field("city_field", "city", 12),
    field("state_field", "state", 13),
    field("zip_field", "zip_code", 14),
    field("dropdown_field", "dropdown", 15, { options: optionValues }),
    field("radio_field", "radio", 16, { options: optionValues }),
    field("checkbox_field", "single_checkbox", 17),
    field("multiple_field", "multiple_checkboxes", 18, { options: optionValues, minSelections: 1 }),
    field("multi_select_field", "multi_select", 19, { options: optionValues }),
    field("yes_no_field", "yes_no", 20),
    field("consent_field", "consent", 21, { required: true, sensitiveClassification: "consent" }),
    field("acknowledgment_field", "electronic_acknowledgment", 22, { required: true, sensitiveClassification: "consent" }),
    field("attendee_group_field", "repeating_attendee_group", 23, { participantFields, maxValue: 5 }),
    field("child_group_field", "repeating_child_group", 24, { participantFields, maxValue: 5, sensitiveClassification: "minor" }),
  ];
  const allFieldSections = validateRegistrationFormSections(section(fields));
  const answers: Record<string, unknown> = {
    first_name_field: "Grace",
    last_name_field: "Tester",
    full_name_field: "Grace Tester",
    short_text_field: "Short",
    long_text_field: "Longer notes",
    email_field: "grace@example.test",
    phone_field: "361-555-0100",
    number_field: 2,
    date_field: "2026-08-10",
    street_field: "100 Main Street",
    city_field: "Palacios",
    state_field: "TX",
    zip_field: "77465",
    dropdown_field: "one",
    radio_field: "two",
    checkbox_field: true,
    multiple_field: ["one"],
    multi_select_field: ["one", "two"],
    yes_no_field: "yes",
    consent_field: true,
    acknowledgment_field: "Grace Tester",
    attendee_group_field: [{ participant_name: "Guest One", participant_age: 24 }],
    child_group_field: [{ participant_name: "Child One", participant_age: 8 }],
  };
  const validatedAnswers = validateRegistrationAnswers({
    sections: allFieldSections,
    answers,
    maximumAttendeesPerRegistration: 10,
  });
  assert.equal(validatedAnswers.contactName, "Grace Tester");
  assert.equal(validatedAnswers.contactEmail, "grace@example.test");
  assert.equal(validatedAnswers.attendeeCount, 1);
  assert.equal(Object.keys(validatedAnswers.answers).length, 23);

  const optionalField = field("optional_field", "short_text", 0);
  assert.equal(
    validateRegistrationAnswers({ sections: section([optionalField]), answers: {}, maximumAttendeesPerRegistration: 5 }).answers.optional_field,
    null,
  );
  expectThrows(
    () => validateRegistrationAnswers({
      sections: section([field("required_field", "short_text", 0, { required: true })]),
      answers: {},
      maximumAttendeesPerRegistration: 5,
    }),
    /required/i,
  );
  expectThrows(
    () => validateRegistrationAnswers({
      sections: section([field("limited_field", "short_text", 0, { maxLength: 5 })]),
      answers: { limited_field: "too long" },
      maximumAttendeesPerRegistration: 5,
    }),
    /no more than 5 characters/i,
  );
  expectThrows(
    () => validateRegistrationAnswers({
      sections: section([field("choice_field", "dropdown", 0, { options: optionValues })]),
      answers: { choice_field: "forged" },
      maximumAttendeesPerRegistration: 5,
    }),
    /invalid selection/i,
  );

  const conditionalSections = validateRegistrationFormSections(section([
    field("has_guest", "yes_no", 0, { required: true }),
    field("guest_name", "short_text", 1, {
      required: true,
      condition: { sourceFieldId: "has_guest", operator: "equals", value: "yes" },
    }),
  ]));
  validateRegistrationAnswers({ sections: conditionalSections, answers: { has_guest: "no" }, maximumAttendeesPerRegistration: 5 });
  expectThrows(
    () => validateRegistrationAnswers({ sections: conditionalSections, answers: { has_guest: "yes" }, maximumAttendeesPerRegistration: 5 }),
    /guest name is required/i,
  );
  expectThrows(
    () => validateRegistrationFormSections(section([
      field("broken_field", "short_text", 0, { condition: { sourceFieldId: "missing_field", operator: "checked" } }),
    ])),
    /missing field/i,
  );
  expectThrows(
    () => validateRegistrationFormSections(section([
      field("loop_one", "short_text", 0, { condition: { sourceFieldId: "loop_two", operator: "equals", value: "yes" } }),
      field("loop_two", "short_text", 1, { condition: { sourceFieldId: "loop_one", operator: "equals", value: "yes" } }),
    ])),
    /loop/i,
  );
  expectThrows(
    () => validateRegistrationFormSections(section([
      field("prohibited_field", "short_text", 0, { label: "Social Security number" }),
    ])),
    /does not permit/i,
  );

  for (const preset of registrationPresets) {
    assert.ok(validateRegistrationFormSections(preset.sections).length > 0, `${preset.name} should validate`);
  }
  assert.equal(registrationPresets.length, 6);
  assert.equal(isSensitiveField(field("allergy_field", "long_text", 0, { sensitiveClassification: "health_accommodation" })), true);
  assert.equal(neutralizeSpreadsheetFormula("=HYPERLINK(\"bad\")"), "'=HYPERLINK(\"bad\")");

  const initialFingerprint = createSchemaFingerprint(section([field("stable_field", "short_text", 0)]));
  const changedFingerprint = createSchemaFingerprint(section([field("stable_field", "short_text", 0, { label: "Updated label" })]));
  assert.notEqual(initialFingerprint, changedFingerprint);

  const event = { startsAt: "2030-08-20T14:00:00.000Z", endsAt: "2030-08-20T18:00:00.000Z" };
  const configuration = getDefaultRegistrationConfiguration({
    eventId: "event-one",
    churchId: "church-one",
    mode: "internal_custom",
    actorUserId: "user-one",
    opensAt: "2030-08-01T14:00:00.000Z",
    closesAt: "2030-08-20T13:00:00.000Z",
    capacity: 50,
  });
  validateRegistrationConfiguration({
    ...configuration,
    registrationClosingReportEnabled: true,
    scheduledReportFormats: ["pdf", "xlsx"],
  }, event);
  expectThrows(
    () => validateRegistrationConfiguration({ ...configuration, retentionDays: 10 }, event),
    />=30|at least 30/i,
  );
  expectThrows(
    () => validateRegistrationConfiguration({ ...configuration, closesAt: "2030-08-21T00:00:00.000Z" }, event),
    /no later than the event ends/i,
  );

  assert.match(validateExternalRegistrationUrl("https://docs.google.com/forms/d/e/example/viewform", "google_forms"), /^https:/);
  assert.match(validateExternalRegistrationUrl("https://forms.gle/example", "google_forms"), /^https:/);
  assert.match(validateExternalRegistrationUrl("https://church.example/register", "external"), /^https:/);
  expectThrows(() => validateExternalRegistrationUrl("http://church.example/register", "external"), /HTTPS/i);
  expectThrows(() => validateExternalRegistrationUrl("https://evilgoogle.com/forms/example", "google_forms"), /Google Forms/i);
  expectThrows(() => validateExternalRegistrationUrl("https://user:pass@example.org/form", "external"), /credentials/i);

  const challengeTime = Date.now() - 2_000;
  const challenge = createRegistrationChallenge(challengeTime);
  assert.equal(verifyRegistrationChallenge(challenge, { now: challengeTime + 2_000 }), true);
  assert.equal(verifyRegistrationChallenge(`${challenge}tampered`, { now: challengeTime + 2_000 }), false);
  assert.deepEqual(parseRegistrationAnswerPayload('{"name":"Grace"}'), { name: "Grace" });
  expectThrows(() => parseRegistrationAnswerPayload("x".repeat(160 * 1024)), /too large/i);

  const prefixes = createRegistrationSearchPrefixes("Grace Maria Tester");
  assert.ok(prefixes.includes("grace"));
  assert.ok(prefixes.includes("maria"));
  assert.ok(prefixes.includes("tester"));

  const normalizedValue: RegistrationAnswerValue = validatedAnswers.answers.multiple_field;
  assert.deepEqual(normalizedValue, ["one"]);

  console.log(JSON.stringify({
    ok: true,
    suite: "registration-validation",
    supportedFieldTypes: fields.length,
    presets: registrationPresets.map((preset) => preset.id),
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
