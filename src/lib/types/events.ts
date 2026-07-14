import type { ChurchPhoto, StructuredAddress } from "@/lib/types/directory";

export const eventStatuses = [
  "draft",
  "pending_review",
  "published",
  "unlisted",
  "cancelled",
  "completed",
  "archived",
] as const;

export type EventStatus = (typeof eventStatuses)[number];

export const eventVisibilityStates = ["public", "unlisted"] as const;

export type EventVisibility = (typeof eventVisibilityStates)[number];

export const eventRegistrationModes = [
  "none",
  "simple_rsvp",
  "internal_custom",
  "google_forms",
  "external",
] as const;

export type EventRegistrationMode = (typeof eventRegistrationModes)[number];

export const eventCostStatuses = ["free", "donation_requested", "fee_required"] as const;

export type EventCostStatus = (typeof eventCostStatuses)[number];

export const eventLocationModes = ["in_person", "online", "hybrid"] as const;

export type EventLocationMode = (typeof eventLocationModes)[number];

export interface EventTaxonomyOption {
  id: string;
  label: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
}

export const eventCategoryGroups = [
  "primary_type",
  "audience_tag",
  "language",
  "accessibility",
  "registration_label",
  "cost_status",
  "seasonal",
] as const;

export type EventCategoryGroup = (typeof eventCategoryGroups)[number];

export interface EventCategoryRecord {
  id: string;
  key: string;
  group: EventCategoryGroup;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  isPrimary: boolean;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string | null;
}

export const eventReportReasons = [
  "incorrect_information",
  "cancelled_not_marked",
  "broken_registration_link",
  "misleading_content",
  "spam",
  "duplicate_event",
  "inappropriate_content",
  "impersonation",
  "other",
] as const;

export type EventReportReason = (typeof eventReportReasons)[number];

export const eventReportStatuses = ["new", "investigating", "resolved", "dismissed"] as const;

export type EventReportStatus = (typeof eventReportStatuses)[number];

export interface EventReportRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  churchId: string;
  churchName: string;
  reason: EventReportReason;
  message: string;
  reporterName?: string | null;
  reporterEmail?: string | null;
  status: EventReportStatus;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
}

export interface EventRegistrationSummary {
  mode: EventRegistrationMode;
  opensAt?: string | null;
  closesAt?: string | null;
  capacity?: number | null;
  waitlistEnabled: boolean;
  externalRegistrationUrl?: string | null;
  externalRegistrationLabel?: string | null;
  setupEnabled?: boolean;
}

export interface EventFlyerImage extends ChurchPhoto {
  storagePath?: string | null;
  downloadUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface EventRecord {
  id: string;
  churchId: string;
  churchName: string;
  churchSlug: string;
  churchRoutePath?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  lastEditedByUserId?: string | null;
  lastEditedByName?: string | null;
  title: string;
  slug: string;
  summary: string;
  description: string;
  primaryType: string;
  audienceTags: string[];
  customTags: string[];
  status: EventStatus;
  visibility: EventVisibility;
  isFeatured: boolean;
  editingLocked?: boolean;
  editingLockedAt?: string | null;
  editingLockedByUserId?: string | null;
  moderationNote?: string | null;
  flyerImage?: EventFlyerImage | null;
  additionalImages: ChurchPhoto[];
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  timeZone: string;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  recurrenceExceptions: string[];
  locationMode: EventLocationMode;
  venueName?: string | null;
  address?: StructuredAddress | null;
  onlineUrl?: string | null;
  mapUrl?: string | null;
  hostMinistry?: string | null;
  coHostDescription?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  languages: string[];
  accessibilityDetails?: string | null;
  childcareProvided: boolean;
  mealProvided: boolean;
  mealDetails?: string | null;
  costStatus: EventCostStatus;
  costDetails?: string | null;
  informationUrl?: string | null;
  additionalInstructions?: string | null;
  registration: EventRegistrationSummary;
  cancellationMessage?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt: string;
  cancelledAt?: string | null;
  archivedAt?: string | null;
  wasPublished: boolean;
}

export interface EventDocument extends EventRecord {}

export interface PublicEventRecord {
  id: string;
  churchId: string;
  churchName: string;
  churchSlug: string;
  churchRoutePath?: string | null;
  title: string;
  slug: string;
  summary: string;
  description: string;
  primaryType: string;
  audienceTags: string[];
  customTags: string[];
  status: "published" | "unlisted" | "cancelled";
  visibility: EventVisibility;
  wasPublished: true;
  isFeatured: boolean;
  flyerImage?: EventFlyerImage | null;
  additionalImages: ChurchPhoto[];
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  timeZone: string;
  locationMode: EventLocationMode;
  venueName?: string | null;
  address?: StructuredAddress | null;
  onlineUrl?: string | null;
  mapUrl?: string | null;
  hostMinistry?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  languages: string[];
  accessibilityDetails?: string | null;
  childcareProvided: boolean;
  mealProvided: boolean;
  mealDetails?: string | null;
  costStatus: EventCostStatus;
  costDetails?: string | null;
  informationUrl?: string | null;
  additionalInstructions?: string | null;
  registration: EventRegistrationSummary;
  cancellationMessage?: string | null;
  publishedAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
}

export interface EventFilters {
  keyword: string;
  churchId: string;
  city: string;
  primaryType: string;
  audienceTag: string;
  language: string;
  startsOnOrAfter: string;
  startsOnOrBefore: string;
  registrationMode: string;
  costStatus: string;
  locationMode: string;
  childcareProvided: boolean;
  wheelchairAccessible: boolean;
}

export const emptyEventFilters: EventFilters = {
  keyword: "",
  churchId: "",
  city: "",
  primaryType: "",
  audienceTag: "",
  language: "",
  startsOnOrAfter: "",
  startsOnOrBefore: "",
  registrationMode: "",
  costStatus: "",
  locationMode: "",
  childcareProvided: false,
  wheelchairAccessible: false,
};
