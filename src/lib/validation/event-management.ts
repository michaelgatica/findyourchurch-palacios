import { imageSize } from "image-size";
import { z } from "zod";

import {
  audienceAndMinistryOptions,
  primaryEventTypeOptions,
} from "@/lib/data/event-taxonomy";
import type {
  EventCostStatus,
  EventLocationMode,
  EventRegistrationMode,
  EventStatus,
  EventVisibility,
} from "@/lib/types/events";

const eventStatusSet = new Set<EventStatus>([
  "draft",
  "pending_review",
  "published",
  "unlisted",
  "cancelled",
  "completed",
  "archived",
]);

const eventVisibilitySet = new Set<EventVisibility>(["public", "unlisted"]);
const eventLocationModeSet = new Set<EventLocationMode>(["in_person", "online", "hybrid"]);
const eventCostStatusSet = new Set<EventCostStatus>([
  "free",
  "donation_requested",
  "fee_required",
]);
const eventRegistrationModeSet = new Set<EventRegistrationMode>([
  "none",
  "simple_rsvp",
  "internal_custom",
  "google_forms",
  "external",
]);

export const eventFlyerAcceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const eventFlyerAcceptedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const eventFlyerMaximumSizeInBytes = 8 * 1024 * 1024;
export const eventFlyerMinimumWidth = 400;
export const eventFlyerMinimumHeight = 300;
export const eventFlyerMaximumWidth = 6000;
export const eventFlyerMaximumHeight = 6000;

export type EventFormIntent =
  | "save_draft"
  | "publish"
  | "update"
  | "unpublish"
  | "cancel"
  | "archive"
  | "restore"
  | "duplicate"
  | "delete_draft";

export interface EventFormValues {
  churchId: string;
  title: string;
  summary: string;
  description: string;
  hostMinistry: string;
  primaryType: string;
  otherPrimaryType: string;
  audienceTags: string[];
  customTags: string[];
  languages: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  timeZone: string;
  recurrenceMode: "single";
  locationMode: EventLocationMode;
  venueName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  postalCode: string;
  onlineUrl: string;
  mapUrl: string;
  accessibilityDetails: string;
  costStatus: EventCostStatus;
  costDetails: string;
  informationUrl: string;
  childcareProvided: boolean;
  mealProvided: boolean;
  mealDetails: string;
  additionalInstructions: string;
  capacity: string;
  visibility: EventVisibility;
  registrationMode: EventRegistrationMode;
  registrationOpensAt: string;
  registrationClosesAt: string;
  externalRegistrationUrl: string;
  externalRegistrationLabel: string;
  flyerAlt: string;
  cancellationMessage: string;
}

export interface ValidatedEventFlyerUpload {
  file: File;
  buffer: Buffer;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
}

export interface ValidatedEventInput {
  values: EventFormValues;
  title: string;
  summary: string;
  description: string;
  hostMinistry?: string;
  primaryType: string;
  audienceTags: string[];
  customTags: string[];
  languages: string[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  timeZone: string;
  locationMode: EventLocationMode;
  venueName?: string;
  address:
    | {
        line1: string;
        line2?: string;
        city: string;
        stateCode: string;
        postalCode: string;
        countryCode: "US";
        latitude: null;
        longitude: null;
      }
    | null;
  onlineUrl?: string;
  mapUrl?: string;
  accessibilityDetails?: string;
  costStatus: EventCostStatus;
  costDetails?: string;
  informationUrl?: string;
  childcareProvided: boolean;
  mealProvided: boolean;
  mealDetails?: string;
  additionalInstructions?: string;
  capacity?: number | null;
  visibility: EventVisibility;
  registrationMode: EventRegistrationMode;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  externalRegistrationUrl?: string | null;
  externalRegistrationLabel?: string | null;
  flyerAlt?: string;
  cancellationMessage?: string;
  flyerUpload?: ValidatedEventFlyerUpload;
  removeFlyer: boolean;
}

const optionalEmail = z.preprocess(
  (value) => normalizeOptionalString(value),
  z.string().email("Enter a valid email address.").optional(),
);

const optionalHttpsUrl = z.preprocess(
  (value) => normalizeOptionalString(value),
  z
    .string()
    .url("Enter a valid URL.")
    .refine((value) => value.startsWith("https://"), "Use a secure HTTPS URL.")
    .optional(),
);

const eventSchema = z.object({
  churchId: z.string().min(1, "Choose a church."),
  title: z.string().min(3, "Enter an event title.").max(120, "Keep the title under 120 characters."),
  summary: z.string().min(10, "Add a short event summary.").max(220, "Keep the summary under 220 characters."),
  description: z.string().min(20, "Add event details.").max(3000, "Keep the description under 3000 characters."),
  hostMinistry: z.string().optional(),
  primaryType: z.string().min(1, "Choose an event type."),
  otherPrimaryType: z.string().optional(),
  audienceTags: z.array(z.string()),
  customTags: z.array(z.string()),
  languages: z.array(z.string()),
  contactName: z.string().optional(),
  contactEmail: optionalEmail,
  contactPhone: z.string().optional(),
  startDate: z.string().min(1, "Choose a start date."),
  startTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean(),
  timeZone: z.string().min(1, "Choose a time zone."),
  recurrenceMode: z.literal("single"),
  locationMode: z.string().refine((value) => eventLocationModeSet.has(value as EventLocationMode), "Choose a location type."),
  venueName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().optional(),
  postalCode: z.string().optional(),
  onlineUrl: optionalHttpsUrl,
  mapUrl: optionalHttpsUrl,
  accessibilityDetails: z.string().optional(),
  costStatus: z.string().refine((value) => eventCostStatusSet.has(value as EventCostStatus), "Choose a cost status."),
  costDetails: z.string().optional(),
  informationUrl: optionalHttpsUrl,
  childcareProvided: z.boolean(),
  mealProvided: z.boolean(),
  mealDetails: z.string().optional(),
  additionalInstructions: z.string().optional(),
  capacity: z.string().optional(),
  visibility: z.string().refine((value) => eventVisibilitySet.has(value as EventVisibility), "Choose a visibility."),
  registrationMode: z.string().refine((value) => eventRegistrationModeSet.has(value as EventRegistrationMode), "Choose a registration mode."),
  registrationOpensAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  externalRegistrationUrl: optionalHttpsUrl,
  externalRegistrationLabel: z.string().optional(),
  flyerAlt: z.string().optional(),
  cancellationMessage: z.string().optional(),
});

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function getString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(formData: FormData, fieldName: string) {
  return formData.get(fieldName) === "on";
}

function getStringList(formData: FormData, fieldName: string) {
  return formData
    .getAll(fieldName)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function splitCommaSeparated(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function combineDateTime(dateValue: string, timeValue: string, allDay: boolean) {
  const normalizedTime = allDay ? "00:00" : timeValue || "00:00";
  return new Date(`${dateValue}T${normalizedTime}:00`).toISOString();
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

async function validateFlyerUpload(formData: FormData): Promise<ValidatedEventFlyerUpload | undefined> {
  const file = formData.get("flyer");

  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }

  const extension = getFileExtension(file.name);

  if (!eventFlyerAcceptedExtensions.has(extension)) {
    throw new Error("Flyers must be JPG, PNG, or WebP images.");
  }

  if (!eventFlyerAcceptedMimeTypes.has(file.type)) {
    throw new Error("Flyers must use a valid JPG, PNG, or WebP content type.");
  }

  if (file.size > eventFlyerMaximumSizeInBytes) {
    throw new Error("Flyers must be 8 MB or smaller.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = imageSize(buffer);
  const width = dimensions.width ?? 0;
  const height = dimensions.height ?? 0;

  if (
    width < eventFlyerMinimumWidth ||
    height < eventFlyerMinimumHeight ||
    width > eventFlyerMaximumWidth ||
    height > eventFlyerMaximumHeight
  ) {
    throw new Error(
      `Flyers must be between ${eventFlyerMinimumWidth}x${eventFlyerMinimumHeight} and ${eventFlyerMaximumWidth}x${eventFlyerMaximumHeight} pixels.`,
    );
  }

  return {
    file,
    buffer,
    originalName: file.name,
    extension,
    mimeType: file.type,
    size: file.size,
    width,
    height,
  };
}

export async function validateEventFormData(formData: FormData): Promise<ValidatedEventInput> {
  const primaryType = getString(formData, "primaryType");
  const parsed = eventSchema.safeParse({
    churchId: getString(formData, "churchId"),
    title: getString(formData, "title"),
    summary: getString(formData, "summary"),
    description: getString(formData, "description"),
    hostMinistry: getString(formData, "hostMinistry"),
    primaryType,
    otherPrimaryType: getString(formData, "otherPrimaryType"),
    audienceTags: getStringList(formData, "audienceTags"),
    customTags: splitCommaSeparated(getString(formData, "customTags")),
    languages: splitCommaSeparated(getString(formData, "languages")),
    contactName: getString(formData, "contactName"),
    contactEmail: getString(formData, "contactEmail"),
    contactPhone: getString(formData, "contactPhone"),
    startDate: getString(formData, "startDate"),
    startTime: getString(formData, "startTime"),
    endDate: getString(formData, "endDate"),
    endTime: getString(formData, "endTime"),
    allDay: getBoolean(formData, "allDay"),
    timeZone: getString(formData, "timeZone") || "America/Chicago",
    recurrenceMode: "single",
    locationMode: getString(formData, "locationMode") || "in_person",
    venueName: getString(formData, "venueName"),
    addressLine1: getString(formData, "addressLine1"),
    addressLine2: getString(formData, "addressLine2"),
    city: getString(formData, "city"),
    stateCode: getString(formData, "stateCode").toUpperCase(),
    postalCode: getString(formData, "postalCode"),
    onlineUrl: getString(formData, "onlineUrl"),
    mapUrl: getString(formData, "mapUrl"),
    accessibilityDetails: getString(formData, "accessibilityDetails"),
    costStatus: getString(formData, "costStatus") || "free",
    costDetails: getString(formData, "costDetails"),
    informationUrl: getString(formData, "informationUrl"),
    childcareProvided: getBoolean(formData, "childcareProvided"),
    mealProvided: getBoolean(formData, "mealProvided"),
    mealDetails: getString(formData, "mealDetails"),
    additionalInstructions: getString(formData, "additionalInstructions"),
    capacity: getString(formData, "capacity"),
    visibility: getString(formData, "visibility") || "public",
    registrationMode: getString(formData, "registrationMode") || "none",
    registrationOpensAt: getString(formData, "registrationOpensAt"),
    registrationClosesAt: getString(formData, "registrationClosesAt"),
    externalRegistrationUrl: getString(formData, "externalRegistrationUrl"),
    externalRegistrationLabel: getString(formData, "externalRegistrationLabel"),
    flyerAlt: getString(formData, "flyerAlt"),
    cancellationMessage: getString(formData, "cancellationMessage"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Please review the highlighted event fields.");
  }

  const values = parsed.data as EventFormValues;
  const selectedPrimaryType =
    values.primaryType === "other"
      ? values.otherPrimaryType.trim()
      : primaryEventTypeOptions.find((option) => option.slug === values.primaryType)?.label ??
        values.primaryType;

  if (!selectedPrimaryType) {
    throw new Error("Enter the custom event type.");
  }

  const startsAt = combineDateTime(values.startDate, values.startTime, values.allDay);
  const endsAt = values.endDate
    ? combineDateTime(values.endDate, values.endTime, values.allDay)
    : null;

  if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    throw new Error("The end date and time must be after the start date and time.");
  }

  const capacity = values.capacity ? Number(values.capacity) : null;

  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) {
    throw new Error("Capacity must be a whole number between 1 and 100000.");
  }

  const requiresAddress = values.locationMode === "in_person" || values.locationMode === "hybrid";

  if (requiresAddress && (!values.addressLine1 || !values.city || !values.stateCode || !values.postalCode)) {
    throw new Error("Add the event address for in-person or hybrid events.");
  }

  if ((values.locationMode === "online" || values.locationMode === "hybrid") && !values.onlineUrl) {
    throw new Error("Add a secure online meeting or streaming link.");
  }

  if (
    (values.registrationMode === "google_forms" || values.registrationMode === "external") &&
    !values.externalRegistrationUrl
  ) {
    throw new Error("Add the secure external registration URL.");
  }

  if (values.registrationMode === "google_forms" && values.externalRegistrationUrl) {
    const hostName = new URL(values.externalRegistrationUrl).hostname.toLowerCase();

    if (!hostName.includes("google.com") && !hostName.includes("forms.gle")) {
      throw new Error("Use a Google Forms URL for Google Forms registration.");
    }
  }

  const flyerUpload = await validateFlyerUpload(formData);

  return {
    values,
    title: values.title,
    summary: values.summary,
    description: values.description,
    hostMinistry: normalizeOptionalString(values.hostMinistry),
    primaryType: selectedPrimaryType,
    audienceTags: values.audienceTags
      .map((tag) => audienceAndMinistryOptions.find((option) => option.slug === tag)?.label ?? tag)
      .filter(Boolean),
    customTags: values.customTags,
    languages: values.languages.length > 0 ? values.languages : ["English"],
    contactName: normalizeOptionalString(values.contactName),
    contactEmail: normalizeOptionalString(values.contactEmail),
    contactPhone: normalizeOptionalString(values.contactPhone),
    startsAt,
    endsAt,
    allDay: values.allDay,
    timeZone: values.timeZone,
    locationMode: values.locationMode,
    venueName: normalizeOptionalString(values.venueName),
    address: requiresAddress
      ? {
          line1: values.addressLine1,
          line2: normalizeOptionalString(values.addressLine2),
          city: values.city,
          stateCode: values.stateCode,
          postalCode: values.postalCode,
          countryCode: "US",
          latitude: null,
          longitude: null,
        }
      : null,
    onlineUrl: normalizeOptionalString(values.onlineUrl),
    mapUrl: normalizeOptionalString(values.mapUrl),
    accessibilityDetails: normalizeOptionalString(values.accessibilityDetails),
    costStatus: values.costStatus,
    costDetails: normalizeOptionalString(values.costDetails),
    informationUrl: normalizeOptionalString(values.informationUrl),
    childcareProvided: values.childcareProvided,
    mealProvided: values.mealProvided,
    mealDetails: normalizeOptionalString(values.mealDetails),
    additionalInstructions: normalizeOptionalString(values.additionalInstructions),
    capacity,
    visibility: values.visibility,
    registrationMode: values.registrationMode,
    registrationOpensAt: values.registrationOpensAt
      ? new Date(values.registrationOpensAt).toISOString()
      : null,
    registrationClosesAt: values.registrationClosesAt
      ? new Date(values.registrationClosesAt).toISOString()
      : null,
    externalRegistrationUrl: normalizeOptionalString(values.externalRegistrationUrl) ?? null,
    externalRegistrationLabel: normalizeOptionalString(values.externalRegistrationLabel) ?? null,
    flyerAlt: normalizeOptionalString(values.flyerAlt),
    cancellationMessage: normalizeOptionalString(values.cancellationMessage),
    flyerUpload,
    removeFlyer: getBoolean(formData, "removeFlyer"),
  };
}

export function isEventStatus(value: string): value is EventStatus {
  return eventStatusSet.has(value as EventStatus);
}
