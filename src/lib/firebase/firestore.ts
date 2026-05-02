import {
  findCityByNameAndStateCode,
  getCityById,
  getCountyById,
  getStateByCode,
  getStateById,
} from "@/lib/data/locations";
import type {
  ChurchDocument,
  ChurchListingDraft,
  ChurchPhoto,
  ChurchRecord,
  CreateChurchSubmissionInput,
  LocationRecord,
  ServiceTime,
  UploadAssetRecord,
} from "@/lib/types/directory";

export const firestoreCollectionNames = {
  churches: "churches",
  churchSubmissions: "churchSubmissions",
  users: "users",
  churchRepresentatives: "churchRepresentatives",
  churchClaimRequests: "churchClaimRequests",
  messages: "messages",
  auditLogs: "auditLogs",
  emailLogs: "emailLogs",
  locations: "locations",
} as const;

export function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createTag(label: string) {
  return {
    id: createSlug(label),
    label,
    slug: createSlug(label),
  };
}

export function createServiceTime(label: string, index: number): ServiceTime {
  return {
    id: `service-time-${index + 1}`,
    label,
    isPrimary: index === 0,
  };
}

export function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  return null;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([entryKey, entryValue]) => [entryKey, stripUndefinedDeep(entryValue)]),
    ) as T;
  }

  return value;
}

function createPhotoGalleryFromUrls(churchName: string, photoUrls: string[]) {
  return photoUrls.map<ChurchPhoto>((photoUrl, index) => ({
    id: `photo-${index + 1}`,
    src: photoUrl,
    alt: `${churchName} church photo ${index + 1}`,
    sortOrder: index + 1,
  }));
}

export function mapChurchDocumentToChurchRecord(churchDocument: ChurchDocument): ChurchRecord {
  const stateRegion = getStateByCode(churchDocument.state);
  const cityRegion = findCityByNameAndStateCode(churchDocument.city, churchDocument.state);

  return {
    id: churchDocument.id,
    slug: churchDocument.slug,
    status: churchDocument.status,
    cityId: cityRegion?.id ?? null,
    countyId: cityRegion?.countyId ?? null,
    stateId: stateRegion?.id ?? null,
    name: churchDocument.name,
    logoSrc: churchDocument.logoUrl ?? null,
    photos:
      churchDocument.photoGallery && churchDocument.photoGallery.length > 0
        ? churchDocument.photoGallery
        : createPhotoGalleryFromUrls(churchDocument.name, churchDocument.photoUrls),
    denomination: churchDocument.denominationTradition,
    specificAffiliation: churchDocument.specificAffiliation,
    clergyLabel: churchDocument.pastorName ? "Pastor / Priest / Reverend" : undefined,
    primaryClergyName: churchDocument.pastorName,
    additionalLeaders: churchDocument.additionalLeaders,
    description: churchDocument.description,
    statementOfFaith: churchDocument.statementOfFaith,
    serviceTimes: churchDocument.serviceTimes,
    address: churchDocument.address,
    phone: churchDocument.phone,
    email: churchDocument.email,
    website: churchDocument.website,
    socialLinks: churchDocument.socialLinks,
    worshipStyle: churchDocument.worshipStyle,
    languages: churchDocument.languages,
    features: {
      childrenMinistry: churchDocument.childrenMinistry,
      youthMinistry: churchDocument.youthMinistry,
      nurseryCare: churchDocument.nurseryCare,
      spanishService: churchDocument.spanishService,
      livestream: churchDocument.livestream,
      wheelchairAccessible: churchDocument.wheelchairAccessible,
    },
    accessibilityDetails: churchDocument.accessibilityDetails,
    visitorParkingDetails: churchDocument.visitorParking,
    firstTimeVisitorNotes: churchDocument.firstTimeVisitorNotes,
    livestreamDetails: churchDocument.livestreamInfo,
    onlineGivingUrl: churchDocument.onlineGivingUrl,
    ministryTags: churchDocument.ministries.map(createTag),
    lastVerifiedAt: churchDocument.lastVerifiedAt ?? null,
    createdAt: churchDocument.createdAt,
    updatedAt: churchDocument.updatedAt,
    publishedAt: churchDocument.publishedAt ?? null,
    primaryRepresentativeId: churchDocument.primaryRepresentativeId ?? null,
    autoPublishUpdates: churchDocument.autoPublishUpdates ?? false,
  };
}

export function mapChurchRecordToChurchDocument(churchRecord: ChurchRecord): ChurchDocument {
  const countyRegion = churchRecord.countyId ? getCountyById(churchRecord.countyId) : null;
  const stateRegion = churchRecord.stateId ? getStateById(churchRecord.stateId) : null;

  return {
    id: churchRecord.id,
    slug: churchRecord.slug,
    name: churchRecord.name,
    status: churchRecord.status,
    logoUrl: churchRecord.logoSrc ?? null,
    photoUrls: churchRecord.photos.map((photo) => photo.src),
    photoGallery: churchRecord.photos,
    address: churchRecord.address,
    city: churchRecord.address.city,
    county: countyRegion?.name ?? null,
    state: stateRegion?.code ?? churchRecord.address.stateCode,
    zip: churchRecord.address.postalCode,
    latitude: churchRecord.address.latitude,
    longitude: churchRecord.address.longitude,
    phone: churchRecord.phone,
    email: churchRecord.email,
    website: churchRecord.website,
    socialLinks: churchRecord.socialLinks,
    pastorName: churchRecord.primaryClergyName,
    additionalLeaders: churchRecord.additionalLeaders,
    denominationTradition: churchRecord.denomination,
    specificAffiliation: churchRecord.specificAffiliation,
    description: churchRecord.description,
    statementOfFaith: churchRecord.statementOfFaith,
    worshipStyle: churchRecord.worshipStyle,
    serviceTimes: churchRecord.serviceTimes,
    languages: churchRecord.languages,
    ministries: churchRecord.ministryTags.map((tag) => tag.label),
    childrenMinistry: churchRecord.features.childrenMinistry,
    youthMinistry: churchRecord.features.youthMinistry,
    nurseryCare: churchRecord.features.nurseryCare,
    spanishService: churchRecord.features.spanishService,
    livestream: churchRecord.features.livestream,
    wheelchairAccessible: churchRecord.features.wheelchairAccessible,
    accessibilityDetails: churchRecord.accessibilityDetails,
    visitorParking: churchRecord.visitorParkingDetails,
    firstTimeVisitorNotes: churchRecord.firstTimeVisitorNotes,
    livestreamInfo: churchRecord.livestreamDetails,
    onlineGivingUrl: churchRecord.onlineGivingUrl,
    primaryRepresentativeId: churchRecord.primaryRepresentativeId ?? null,
    autoPublishUpdates: churchRecord.autoPublishUpdates ?? false,
    lastVerifiedAt: churchRecord.lastVerifiedAt ?? null,
    createdAt: churchRecord.createdAt ?? churchRecord.updatedAt,
    updatedAt: churchRecord.updatedAt,
    publishedAt: churchRecord.publishedAt ?? null,
  };
}

export function buildChurchDraftFromSubmissionInput(
  input: CreateChurchSubmissionInput,
  uploads: UploadAssetRecord[],
): ChurchListingDraft {
  const matchedCity = findCityByNameAndStateCode(input.city, input.stateCode) ?? null;
  const matchedState = getStateByCode(input.stateCode) ?? null;
  const logoUpload = uploads.find((uploadRecord) => uploadRecord.kind === "logo");
  const photoUploads = uploads.filter((uploadRecord) => uploadRecord.kind === "photo");

  return {
    cityId: matchedCity?.id ?? null,
    countyId: matchedCity?.countyId ?? null,
    stateId: matchedCity?.stateId ?? matchedState?.id ?? null,
    name: input.churchName,
    logoSrc: logoUpload?.downloadUrl ?? logoUpload?.relativePath ?? null,
    photos: photoUploads.map((uploadRecord, index) => ({
      id: uploadRecord.id,
      src: uploadRecord.downloadUrl ?? uploadRecord.relativePath,
      alt: `${input.churchName} pending review upload ${index + 1}`,
      sortOrder: index + 1,
    })),
    denomination: input.denomination,
    specificAffiliation: input.specificAffiliation,
    clergyLabel: input.clergyName ? "Pastor / Priest / Reverend" : undefined,
    primaryClergyName: input.clergyName,
    additionalLeaders: input.additionalLeaders,
    description: input.shortDescription,
    statementOfFaith: input.statementOfFaith,
    serviceTimes: input.serviceTimes.map(createServiceTime),
    address: {
      line1: input.addressLine1,
      line2: input.addressLine2,
      city: input.city,
      stateCode: input.stateCode,
      postalCode: input.postalCode,
      countyId: matchedCity?.countyId ?? null,
      countryCode: "US",
      latitude: null,
      longitude: null,
    },
    phone: input.phone,
    email: input.email,
    website: input.websiteUrl,
    socialLinks: {
      facebook: input.facebookUrl,
      instagram: input.instagramUrl,
      youtube: input.youtubeUrl,
    },
    worshipStyle: input.worshipStyle,
    languages: input.languages,
    features: {
      childrenMinistry: input.childrenMinistryAvailable,
      youthMinistry: input.youthMinistryAvailable,
      nurseryCare: input.nurseryCareAvailable,
      spanishService: input.spanishServiceAvailable,
      livestream: input.livestreamAvailable,
      wheelchairAccessible: input.wheelchairAccessible,
    },
    accessibilityDetails: input.accessibilityDetails,
    visitorParkingDetails: input.visitorParkingDetails,
    firstTimeVisitorNotes: input.firstTimeVisitorNotes,
    livestreamDetails: input.livestreamAvailable
      ? "Livestream details pending review."
      : undefined,
    onlineGivingUrl: input.onlineGivingUrl,
    ministryTags: input.ministryTags.map(createTag),
    lastVerifiedAt: null,
  };
}

export function mapDraftToChurchDocument(
  churchId: string,
  slug: string,
  churchDraft: ChurchListingDraft,
  status: ChurchRecord["status"],
  createdAt: string,
  updatedAt: string,
): ChurchDocument {
  const countyRegion = churchDraft.countyId ? getCountyById(churchDraft.countyId) : null;

  return {
    id: churchId,
    slug,
    name: churchDraft.name,
    status,
    logoUrl: churchDraft.logoSrc ?? null,
    photoUrls: churchDraft.photos.map((photo) => photo.src),
    photoGallery: churchDraft.photos,
    address: churchDraft.address,
    city: churchDraft.address.city,
    county: countyRegion?.name ?? null,
    state: churchDraft.address.stateCode,
    zip: churchDraft.address.postalCode,
    latitude: churchDraft.address.latitude,
    longitude: churchDraft.address.longitude,
    phone: churchDraft.phone,
    email: churchDraft.email,
    website: churchDraft.website,
    socialLinks: churchDraft.socialLinks,
    pastorName: churchDraft.primaryClergyName,
    additionalLeaders: churchDraft.additionalLeaders,
    denominationTradition: churchDraft.denomination,
    specificAffiliation: churchDraft.specificAffiliation,
    description: churchDraft.description,
    statementOfFaith: churchDraft.statementOfFaith,
    worshipStyle: churchDraft.worshipStyle,
    serviceTimes: churchDraft.serviceTimes,
    languages: churchDraft.languages,
    ministries: churchDraft.ministryTags.map((tag) => tag.label),
    childrenMinistry: churchDraft.features.childrenMinistry,
    youthMinistry: churchDraft.features.youthMinistry,
    nurseryCare: churchDraft.features.nurseryCare,
    spanishService: churchDraft.features.spanishService,
    livestream: churchDraft.features.livestream,
    wheelchairAccessible: churchDraft.features.wheelchairAccessible,
    accessibilityDetails: churchDraft.accessibilityDetails,
    visitorParking: churchDraft.visitorParkingDetails,
    firstTimeVisitorNotes: churchDraft.firstTimeVisitorNotes,
    livestreamInfo: churchDraft.livestreamDetails,
    onlineGivingUrl: churchDraft.onlineGivingUrl,
    primaryRepresentativeId: null,
    autoPublishUpdates: false,
    lastVerifiedAt: churchDraft.lastVerifiedAt ?? null,
    createdAt,
    updatedAt,
    publishedAt: status === "published" ? updatedAt : null,
  };
}

export function buildLocationRecords() {
  const now = new Date().toISOString();

  return [
    {
      id: "palacios-texas",
      city: "Palacios",
      county: "Matagorda County",
      state: "Texas",
      stateSlug: "texas",
      citySlug: "palacios",
      countySlug: "matagorda-county",
      isActiveLaunchMarket: true,
      createdAt: now,
      updatedAt: now,
    },
  ] satisfies LocationRecord[];
}
