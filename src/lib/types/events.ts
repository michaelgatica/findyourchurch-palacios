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

export interface EventRegistrationSummary {
  mode: EventRegistrationMode;
  opensAt?: string | null;
  closesAt?: string | null;
  capacity?: number | null;
  waitlistEnabled: boolean;
  externalRegistrationUrl?: string | null;
  externalRegistrationLabel?: string | null;
}

export interface EventRecord {
  id: string;
  churchId: string;
  churchName: string;
  churchSlug: string;
  createdByUserId?: string | null;
  lastEditedByUserId?: string | null;
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
  flyerImage?: ChurchPhoto | null;
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
  registration: EventRegistrationSummary;
  cancellationMessage?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt: string;
  cancelledAt?: string | null;
  archivedAt?: string | null;
}

export interface EventDocument extends EventRecord {}

export interface EventFilters {
  keyword: string;
  churchId: string;
  city: string;
  primaryType: string;
  audienceTag: string;
  language: string;
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
  registrationMode: "",
  costStatus: "",
  locationMode: "",
  childcareProvided: false,
  wheelchairAccessible: false,
};
