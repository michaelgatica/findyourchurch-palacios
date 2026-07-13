import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

import type {
  RegistrationAnswerValue,
  RegistrationFieldCondition,
  RegistrationFieldSchema,
  RegistrationFormSection,
} from "@/lib/types/registrations";

const prohibitedQuestionPatterns = [
  /social security/i,
  /\bssn\b/i,
  /driver'?s? licen[cs]e/i,
  /government (id|identification)/i,
  /passport number/i,
  /credit card/i,
  /debit card/i,
  /bank account/i,
  /routing number/i,
];

export function hashRegistrationSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createRegistrationAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function createConfirmationNumber() {
  return `FYC-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export function normalizeRegistrationSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createRegistrationSearchPrefixes(contactName: string) {
  const normalizedName = normalizeRegistrationSearchText(contactName).slice(0, 80);
  const searchableValues = [normalizedName, ...normalizedName.split(" ")].filter(
    (value) => value.length >= 2,
  );
  const prefixes = new Set<string>();

  for (const value of searchableValues) {
    for (let length = 2; length <= Math.min(value.length, 40); length += 1) {
      prefixes.add(value.slice(0, length));
    }
  }

  return [...prefixes].slice(0, 160);
}

export function createSchemaFingerprint(sections: RegistrationFormSection[]) {
  return createHash("sha256").update(JSON.stringify(sections)).digest("hex");
}

function getChallengeSecret() {
  const configuredSecret = process.env.REGISTRATION_TOKEN_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REGISTRATION_TOKEN_SECRET is required in production.");
  }

  return "local-registration-challenge-only";
}

export function createRegistrationChallenge(now = Date.now()) {
  const timestamp = String(now);
  const signature = createHmac("sha256", getChallengeSecret()).update(timestamp).digest("base64url");
  return `${timestamp}.${signature}`;
}

export function verifyRegistrationChallenge(
  challenge: string,
  options: { now?: number; minimumAgeMs?: number; maximumAgeMs?: number } = {},
) {
  const [timestampValue, suppliedSignature] = challenge.split(".");
  const timestamp = Number(timestampValue);
  const now = options.now ?? Date.now();
  const minimumAgeMs = options.minimumAgeMs ?? (process.env.NODE_ENV === "test" ? 0 : 900);
  const maximumAgeMs = options.maximumAgeMs ?? 2 * 60 * 60 * 1000;

  if (!timestampValue || !suppliedSignature || !Number.isFinite(timestamp)) {
    return false;
  }

  const age = now - timestamp;

  if (age < minimumAgeMs || age > maximumAgeMs) {
    return false;
  }

  const expectedSignature = createHmac("sha256", getChallengeSecret())
    .update(timestampValue)
    .digest("base64url");
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function isProhibitedRegistrationQuestion(field: RegistrationFieldSchema) {
  const searchableText = [field.label, field.helpText, field.organizerExplanation]
    .filter(Boolean)
    .join(" ");
  return prohibitedQuestionPatterns.some((pattern) => pattern.test(searchableText));
}

export function isSensitiveField(field: RegistrationFieldSchema) {
  return field.sensitiveClassification !== "none" &&
    field.sensitiveClassification !== "standard_contact";
}

function valueIsChecked(value: RegistrationAnswerValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

export function conditionIsMet(
  condition: RegistrationFieldCondition | null | undefined,
  answers: Record<string, RegistrationAnswerValue>,
) {
  if (!condition) {
    return true;
  }

  const sourceValue = answers[condition.sourceFieldId];

  if (condition.operator === "checked") {
    return valueIsChecked(sourceValue);
  }

  if (condition.operator === "greater_than") {
    return Number(sourceValue) > Number(condition.value ?? 0);
  }

  if (Array.isArray(sourceValue)) {
    return sourceValue.map(String).includes(String(condition.value ?? ""));
  }

  return String(sourceValue ?? "") === String(condition.value ?? "");
}

export function flattenRegistrationFields(sections: RegistrationFormSection[]) {
  return sections
    .toSorted((left, right) => left.displayOrder - right.displayOrder)
    .flatMap((section) =>
      section.fields.toSorted((left, right) => left.displayOrder - right.displayOrder),
    );
}

export function neutralizeSpreadsheetFormula(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function maskSensitiveValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return "Sensitive value withheld";
}
