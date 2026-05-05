export const churchStatuses = [
  "draft",
  "pending_review",
  "published",
  "archived",
  "denied",
  "changes_requested",
] as const;

export type ChurchStatus = (typeof churchStatuses)[number];

export const churchListingVerificationStatuses = [
  "current",
  "acknowledgement_due",
  "grace_period",
  "archived",
] as const;

export type ChurchListingVerificationStatus =
  (typeof churchListingVerificationStatuses)[number];

export const churchSubmissionStatuses = [
  "pending_review",
  "approved",
  "denied",
  "changes_requested",
] as const;

export type ChurchSubmissionStatus = (typeof churchSubmissionStatuses)[number];

export const appUserRoles = [
  "admin",
  "church_primary",
  "church_editor",
  "pending_user",
] as const;

export type AppUserRole = (typeof appUserRoles)[number];

export const churchRepresentativePermissionRoles = [
  "primary_owner",
  "editor",
] as const;

export type ChurchRepresentativePermissionRole =
  (typeof churchRepresentativePermissionRoles)[number];

export const churchRepresentativeStatuses = [
  "invited",
  "active",
  "suspended",
  "transferred",
] as const;

export type ChurchRepresentativeStatus =
  (typeof churchRepresentativeStatuses)[number];

export const churchClaimRequestStatuses = [
  "pending_review",
  "approved",
  "denied",
  "more_info_requested",
] as const;

export type ChurchClaimRequestStatus =
  (typeof churchClaimRequestStatuses)[number];

export const churchUpdateRequestStatuses = [
  "pending_review",
  "approved",
  "denied",
  "changes_requested",
] as const;

export type ChurchUpdateRequestStatus =
  (typeof churchUpdateRequestStatuses)[number];

export const ownershipTransferRequestStatuses = [
  "pending_review",
  "approved",
  "denied",
] as const;

export type OwnershipTransferRequestStatus =
  (typeof ownershipTransferRequestStatuses)[number];

export const messageSenderTypes = [
  "admin",
  "church_rep",
  "submitter",
] as const;

export type MessageSenderType = (typeof messageSenderTypes)[number];

export const storageBackends = ["firebase", "local"] as const;

export type StorageBackend = (typeof storageBackends)[number];

export const repositoryModes = ["firebase", "local"] as const;

export type RepositoryMode = (typeof repositoryModes)[number];

export interface StateRegion {
  id: string;
  name: string;
  code: string;
  slug: string;
}

export interface CountyRegion {
  id: string;
  name: string;
  slug: string;
  stateId: string;
}

export interface CityRegion {
  id: string;
  name: string;
  slug: string;
  stateCode: string;
  stateId: string;
  countyId: string;
}

export interface LaunchMarketBrandAssets {
  landscapeLogoSrc: string;
  squareLogoSrc: string;
}

export interface LaunchMarket {
  id: string;
  name: string;
  launchName: string;
  primaryCityId: string;
  nearbyCityIds: string[];
  stateId: string;
  countyIds: string[];
  contactEmail: string;
  localAreaLabel: string;
  communityLabel: string;
  heroTitle: string;
  heroLead: string;
  heroPanelTitle: string;
  directoryHeading: string;
  directoryLead: string;
  launchDescription: string;
  directoryDescription: string;
  currentListingScope: string;
  launchVision: string;
  brandAssets: LaunchMarketBrandAssets;
}

export interface StructuredAddress {
  line1: string;
  line2?: string;
  city: string;
  stateCode: string;
  postalCode: string;
  countyId?: string | null;
  countryCode: "US";
  latitude: number | null;
  longitude: number | null;
}

export interface ChurchRepresentative {
  name: string;
  email: string;
  roleTitle: string;
  phone?: string;
}

export interface ChurchPhoto {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  sortOrder: number;
}

export interface ServiceTime {
  id: string;
  label: string;
  dayLabel?: string;
  startTime?: string;
  notes?: string;
  isPrimary?: boolean;
}

export interface MinistryTag {
  id: string;
  label: string;
  slug: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
}

export interface ChurchFeatures {
  childrenMinistry: boolean;
  youthMinistry: boolean;
  nurseryCare: boolean;
  spanishService: boolean;
  livestream: boolean;
  wheelchairAccessible: boolean;
}

export interface ChurchListingDraft {
  cityId: string | null;
  countyId: string | null;
  stateId: string | null;
  name: string;
  customShareSlug?: string | null;
  logoSrc?: string | null;
  photos: ChurchPhoto[];
  denomination: string;
  specificAffiliation?: string;
  clergyLabel?: string;
  primaryClergyName?: string;
  additionalLeaders: string[];
  description: string;
  statementOfFaith?: string;
  serviceTimes: ServiceTime[];
  address: StructuredAddress;
  phone: string;
  email?: string;
  website?: string;
  socialLinks: SocialLinks;
  worshipStyle?: string;
  languages: string[];
  features: ChurchFeatures;
  accessibilityDetails?: string;
  visitorParkingDetails?: string;
  firstTimeVisitorNotes?: string;
  livestreamDetails?: string;
  onlineGivingUrl?: string;
  ministryTags: MinistryTag[];
  lastVerifiedAt?: string | null;
}

export interface ChurchRecord extends ChurchListingDraft {
  id: string;
  slug: string;
  status: ChurchStatus;
  listingVerificationStatus?: ChurchListingVerificationStatus;
  lastListingAcknowledgedAt?: string | null;
  lastRepresentativeActivityAt?: string | null;
  listingVerificationRequestedAt?: string | null;
  listingVerificationGraceEndsAt?: string | null;
  listingVerificationReminder7SentAt?: string | null;
  listingVerificationReminder3SentAt?: string | null;
  listingVerificationToken?: string | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  createdAt?: string;
  updatedAt: string;
  publishedAt?: string | null;
  primaryRepresentativeId?: string | null;
  autoPublishUpdates?: boolean;
  submittedAt?: string;
  isSeedContent?: boolean;
}

export interface UploadAssetRecord {
  id: string;
  kind: "logo" | "photo";
  originalName: string;
  storedName: string;
  relativePath: string;
  storagePath?: string;
  downloadUrl?: string;
  backend: StorageBackend;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export interface ChurchSubmissionRecord {
  id: string;
  slug: string;
  status: ChurchSubmissionStatus;
  churchDraft: ChurchListingDraft;
  // Legacy alias retained so local fallback data can evolve safely.
  church?: ChurchListingDraft;
  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string;
  submitterRole: string;
  communicationConsentAcceptedAt: string;
  termsAcceptedAt: string;
  followUpEmailOptIn: boolean;
  requestedManagerAccount?: SubmissionManagerAccountRecord;
  adminMessage?: string;
  internalNotes: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  deniedAt?: string | null;
  requestedChangesAt?: string | null;
  submittedAt?: string;
  source: "public_form";
  uploads: UploadAssetRecord[];
}

export interface CreateChurchSubmissionInput {
  churchName: string;
  customShareSlug?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateCode: string;
  postalCode: string;
  phone: string;
  email: string;
  denomination: string;
  shortDescription: string;
  serviceTimes: string[];
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactRole: string;
  primaryContactPhone?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  clergyName?: string;
  additionalLeaders: string[];
  specificAffiliation?: string;
  statementOfFaith?: string;
  worshipStyle?: string;
  languages: string[];
  spanishServiceAvailable: boolean;
  livestreamAvailable: boolean;
  onlineGivingUrl?: string;
  childrenMinistryAvailable: boolean;
  youthMinistryAvailable: boolean;
  nurseryCareAvailable: boolean;
  wheelchairAccessible: boolean;
  accessibilityDetails?: string;
  visitorParkingDetails?: string;
  firstTimeVisitorNotes?: string;
  ministryTags: string[];
  communicationConsent: boolean;
  termsAccepted: boolean;
  followUpEmailOptIn: boolean;
}

export type SubmissionManagerAccountAssignmentStatus =
  | "pending_submission_approval"
  | "assigned_as_primary_owner"
  | "manual_review_required";

export interface SubmissionManagerAccountRecord {
  firebaseUid: string;
  email: string;
  name: string;
  phone?: string;
  roleTitle: string;
  requestedAt: string;
  assignmentStatus: SubmissionManagerAccountAssignmentStatus;
}

export interface DirectoryFilters {
  keyword: string;
  denomination: string;
  worshipStyle: string;
  childrenMinistry: boolean;
  youthMinistry: boolean;
  nurseryCare: boolean;
  spanishService: boolean;
  livestream: boolean;
  wheelchairAccessible: boolean;
}

export interface SubmissionFormValues {
  churchName: string;
  customShareSlug: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  postalCode: string;
  phone: string;
  email: string;
  denomination: string;
  churchDescription: string;
  serviceTimes: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactRole: string;
  primaryContactPhone: string;
  websiteUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  clergyName: string;
  additionalLeaders: string;
  specificAffiliation: string;
  statementOfFaith: string;
  worshipStyle: string;
  languagesOffered: string;
  onlineGivingUrl: string;
  accessibilityDetails: string;
  visitorParkingDetails: string;
  firstTimeVisitorNotes: string;
  ministryTags: string;
  createManagerAccount: boolean;
  communicationConsent: boolean;
  termsAccepted: boolean;
  followUpEmailOptIn: boolean;
  spanishServiceAvailable: boolean;
  livestreamAvailable: boolean;
  childrenMinistryAvailable: boolean;
  youthMinistryAvailable: boolean;
  nurseryCareAvailable: boolean;
  wheelchairAccessible: boolean;
}

export type SubmissionFieldErrorKey =
  | keyof SubmissionFormValues
  | "managerAccountPassword"
  | "managerAccountPasswordConfirmation"
  | "churchLogo"
  | "churchPhotos";

export interface SubmissionFormState {
  status: "idle" | "error";
  formError?: string;
  errors: Partial<Record<SubmissionFieldErrorKey, string>>;
  values: SubmissionFormValues;
}

export interface DirectoryFilterOptions {
  denominations: string[];
  worshipStyles: string[];
}

export interface ChurchDocument {
  id: string;
  slug: string;
  name: string;
  customShareSlug?: string | null;
  status: ChurchStatus;
  listingVerificationStatus?: ChurchListingVerificationStatus;
  lastListingAcknowledgedAt?: string | null;
  lastRepresentativeActivityAt?: string | null;
  listingVerificationRequestedAt?: string | null;
  listingVerificationGraceEndsAt?: string | null;
  listingVerificationReminder7SentAt?: string | null;
  listingVerificationReminder3SentAt?: string | null;
  listingVerificationToken?: string | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  logoUrl?: string | null;
  photoUrls: string[];
  photoGallery?: ChurchPhoto[];
  address: StructuredAddress;
  city: string;
  county?: string | null;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email?: string;
  website?: string;
  socialLinks: SocialLinks;
  pastorName?: string;
  additionalLeaders: string[];
  denominationTradition: string;
  specificAffiliation?: string;
  description: string;
  statementOfFaith?: string;
  worshipStyle?: string;
  serviceTimes: ServiceTime[];
  languages: string[];
  ministries: string[];
  childrenMinistry: boolean;
  youthMinistry: boolean;
  nurseryCare: boolean;
  spanishService: boolean;
  livestream: boolean;
  wheelchairAccessible: boolean;
  accessibilityDetails?: string;
  visitorParking?: string;
  firstTimeVisitorNotes?: string;
  livestreamInfo?: string;
  onlineGivingUrl?: string;
  primaryRepresentativeId?: string | null;
  autoPublishUpdates?: boolean;
  lastVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface AppUserRecord {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  phone?: string;
  role: AppUserRole;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchRepresentativeRecord {
  id: string;
  churchId: string;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string;
  roleTitle: string;
  permissionRole: ChurchRepresentativePermissionRole;
  status: ChurchRepresentativeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchClaimRequestRecord {
  id: string;
  churchId: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  requesterRoleTitle: string;
  relationshipToChurch: string;
  proofOrExplanation: string;
  communicationConsentAcceptedAt: string;
  termsAcceptedAt: string;
  followUpEmailOptIn: boolean;
  status: ChurchClaimRequestStatus;
  adminMessage?: string;
  reviewedBy?: string;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChurchClaimRequestInput {
  churchId: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  requesterRoleTitle: string;
  relationshipToChurch: string;
  proofOrExplanation: string;
  communicationConsent: boolean;
  termsAccepted: boolean;
  followUpEmailOptIn: boolean;
}

export interface MessageRecord {
  id: string;
  churchId?: string;
  submissionId?: string;
  claimRequestId?: string;
  updateRequestId?: string;
  senderId: string;
  senderType: MessageSenderType;
  messageBody: string;
  isInternal: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface CreateMessageInput {
  churchId?: string;
  submissionId?: string;
  claimRequestId?: string;
  updateRequestId?: string;
  senderId: string;
  senderType: MessageSenderType;
  messageBody: string;
  isInternal?: boolean;
}

export interface AuditLogRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorType?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
  createdAt: string;
}

export interface CreateAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorType?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

export interface EmailLogRecord {
  id: string;
  to: string;
  from?: string;
  subject: string;
  bodyPreview: string;
  status: string;
  provider?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
}

export interface ChurchUpdateRequestRecord {
  id: string;
  churchId: string;
  submittedByUserId: string;
  submittedByRepresentativeId: string;
  proposedChanges: ChurchListingDraft;
  status: ChurchUpdateRequestStatus;
  adminMessage?: string;
  internalNotes: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  deniedAt?: string | null;
  requestedChangesAt?: string | null;
  reviewedBy?: string;
  source: "church_portal";
  autoPublished?: boolean;
}

export interface OwnershipTransferRequestRecord {
  id: string;
  churchId: string;
  requestedByUserId: string;
  requestedByRepresentativeId: string;
  currentOwnerRepresentativeId: string;
  newOwnerName: string;
  newOwnerEmail: string;
  newOwnerPhone?: string;
  newOwnerRoleTitle: string;
  reasonMessage: string;
  status: OwnershipTransferRequestStatus;
  adminMessage?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  deniedAt?: string | null;
  reviewedBy?: string;
}

export interface LocationRecord {
  id: string;
  city: string;
  county: string;
  state: string;
  stateSlug: string;
  citySlug: string;
  countySlug: string;
  isActiveLaunchMarket: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedAppUser {
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
  profile: AppUserRecord | null;
}

export const emptyDirectoryFilters: DirectoryFilters = {
  keyword: "",
  denomination: "",
  worshipStyle: "",
  childrenMinistry: false,
  youthMinistry: false,
  nurseryCare: false,
  spanishService: false,
  livestream: false,
  wheelchairAccessible: false,
};

export const emptySubmissionFormValues: SubmissionFormValues = {
  churchName: "",
  customShareSlug: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateCode: "",
  postalCode: "",
  phone: "",
  email: "",
  denomination: "",
  churchDescription: "",
  serviceTimes: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactRole: "",
  primaryContactPhone: "",
  websiteUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
  clergyName: "",
  additionalLeaders: "",
  specificAffiliation: "",
  statementOfFaith: "",
  worshipStyle: "",
  languagesOffered: "",
  onlineGivingUrl: "",
  accessibilityDetails: "",
  visitorParkingDetails: "",
  firstTimeVisitorNotes: "",
  ministryTags: "",
  createManagerAccount: false,
  communicationConsent: false,
  termsAccepted: false,
  followUpEmailOptIn: false,
  spanishServiceAvailable: false,
  livestreamAvailable: false,
  childrenMinistryAvailable: false,
  youthMinistryAvailable: false,
  nurseryCareAvailable: false,
  wheelchairAccessible: false,
};

export const emptySubmissionFormState: SubmissionFormState = {
  status: "idle",
  errors: {},
  values: emptySubmissionFormValues,
};
