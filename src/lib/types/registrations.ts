export const registrationFieldTypes = [
  "section_heading",
  "informational_text",
  "first_name",
  "last_name",
  "full_name",
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "date",
  "street_address",
  "city",
  "state",
  "zip_code",
  "dropdown",
  "radio",
  "single_checkbox",
  "multiple_checkboxes",
  "multi_select",
  "yes_no",
  "consent",
  "electronic_acknowledgment",
  "repeating_attendee_group",
  "repeating_child_group",
] as const;

export type RegistrationFieldType = (typeof registrationFieldTypes)[number];

export const sensitiveDataClassifications = [
  "standard_contact",
  "address",
  "minor",
  "emergency",
  "health_accommodation",
  "consent",
  "organizer_sensitive",
  "none",
] as const;

export type SensitiveDataClassification =
  (typeof sensitiveDataClassifications)[number];

export type RegistrationConditionOperator = "equals" | "checked" | "greater_than";

export interface RegistrationFieldCondition {
  sourceFieldId: string;
  operator: RegistrationConditionOperator;
  value?: string | number | boolean;
}

export interface RegistrationFieldSchema {
  id: string;
  type: RegistrationFieldType;
  label: string;
  helpText?: string;
  placeholder?: string;
  required: boolean;
  options: Array<{ id: string; label: string; value: string }>;
  minValue?: number | null;
  maxValue?: number | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  defaultValue?: string | number | boolean | string[] | null;
  displayOrder: number;
  includeInExports: boolean;
  sensitiveClassification: SensitiveDataClassification;
  condition?: RegistrationFieldCondition | null;
  organizerExplanation?: string;
  participantFields?: RegistrationFieldSchema[];
}

export interface RegistrationFormSection {
  id: string;
  title: string;
  description?: string;
  displayOrder: number;
  fields: RegistrationFieldSchema[];
}

export type RegistrationFormVersionStatus = "draft" | "active" | "retired";

export interface RegistrationFormVersionRecord {
  id: string;
  eventId: string;
  churchId: string;
  version: number;
  status: RegistrationFormVersionStatus;
  title: string;
  presetId?: string | null;
  sections: RegistrationFormSection[];
  schemaFingerprint: string;
  createdByUserId: string;
  createdAt: string;
  activatedAt?: string | null;
  retiredAt?: string | null;
}

export type RegistrationCapacityUnit = "registrations" | "attendees";

export interface EventRegistrationConfigurationRecord {
  id: string;
  eventId: string;
  churchId: string;
  mode: "none" | "simple_rsvp" | "internal_custom" | "google_forms" | "external";
  activeFormVersionId?: string | null;
  draftFormVersionId?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  capacity?: number | null;
  capacityUnit: RegistrationCapacityUnit;
  maximumAttendeesPerRegistration: number;
  waitlistEnabled: boolean;
  waitlistCapacity?: number | null;
  automaticWaitlistPromotion: boolean;
  allowRegistrantEditing: boolean;
  allowRegistrantCancellation: boolean;
  showCapacityStatus: boolean;
  confirmationEmailEnabled: boolean;
  reminderEmailEnabled: boolean;
  organizerNewRegistrationEmail: boolean;
  organizerDailyDigestEmail: boolean;
  registrationClosingReportEnabled: boolean;
  preEventReportEnabled: boolean;
  scheduledReportFormats: RegistrationExportFormat[];
  successMessage: string;
  closedMessage: string;
  waitlistMessage: string;
  consentText?: string | null;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
}

export type RegistrationStatus =
  | "confirmed"
  | "waitlisted"
  | "cancelled"
  | "checked_in"
  | "attended"
  | "no_show";

export type RegistrationAnswerValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string | number | boolean | string[]>[]
  | null;

export interface RegistrationRecord {
  id: string;
  eventId: string;
  churchId: string;
  formVersionId: string;
  formVersion: number;
  formTitle: string;
  confirmationNumber: string;
  status: RegistrationStatus;
  contactName: string;
  contactNameNormalized: string;
  contactSearchPrefixes: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  attendeeCount: number;
  capacityUnits: number;
  answers: Record<string, RegistrationAnswerValue>;
  answerLabels: Record<string, string>;
  privateOrganizerNotes?: string | null;
  source: "public" | "manual";
  idempotencyKeyHash: string;
  submittedAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  checkedInAt?: string | null;
  attendedAt?: string | null;
  noShowAt?: string | null;
  lastEditedByUserId?: string | null;
}

export interface RegistrationCounterRecord {
  eventId: string;
  churchId: string;
  submitted: number;
  confirmed: number;
  waitlisted: number;
  cancelled: number;
  checkedIn: number;
  attended: number;
  noShow: number;
  confirmedAttendees: number;
  waitlistedAttendees: number;
  updatedAt: string;
}

export interface RegistrationAccessTokenRecord {
  id: string;
  registrationId: string;
  eventId: string;
  churchId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export type RegistrationExportFormat = "pdf" | "xlsx";
export type RegistrationPdfType = "roster" | "sign_in" | "check_in";

export interface EventExportRecord {
  id: string;
  eventId: string;
  churchId: string;
  requestedByUserId: string;
  format: RegistrationExportFormat;
  reportType: RegistrationPdfType | "workbook";
  orientation?: "portrait" | "landscape";
  selectedFieldIds: string[];
  sensitiveFieldsIncluded: boolean;
  storagePath: string;
  contentType: string;
  fileName: string;
  createdAt: string;
  expiresAt: string;
  downloadedAt?: string | null;
  emailedAt?: string | null;
  correlationId: string;
}

export type RegistrationJobType =
  | "registration_closing_report"
  | "pre_event_report"
  | "daily_digest"
  | "event_reminder"
  | "event_reminder_notice"
  | "event_cancellation_notice"
  | "export_cleanup"
  | "registration_retention_cleanup";

export interface RegistrationScheduledJobRecord {
  id: string;
  eventId?: string | null;
  churchId?: string | null;
  type: RegistrationJobType;
  status: "pending" | "processing" | "completed" | "failed";
  scheduledFor: string;
  idempotencyKey: string;
  attempts: number;
  maxAttempts?: number;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  leaseOwnerId?: string | null;
  leaseExpiresAt?: string | null;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
  lastFailedAt?: string | null;
  deliveryCompletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}
