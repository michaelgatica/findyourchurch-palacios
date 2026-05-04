import type { ChurchRecord } from "@/lib/types/directory";

export interface ChurchListingFormValues {
  churchId: string;
  churchSlug: string;
  churchName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  stateCode: string;
  postalCode: string;
  phone: string;
  email: string;
  websiteUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  clergyName: string;
  additionalLeaders: string;
  denomination: string;
  specificAffiliation: string;
  churchDescription: string;
  statementOfFaith: string;
  worshipStyle: string;
  serviceTimes: string;
  languagesOffered: string;
  onlineGivingUrl: string;
  accessibilityDetails: string;
  visitorParkingDetails: string;
  firstTimeVisitorNotes: string;
  ministryTags: string;
  spanishServiceAvailable: boolean;
  livestreamAvailable: boolean;
  childrenMinistryAvailable: boolean;
  youthMinistryAvailable: boolean;
  nurseryCareAvailable: boolean;
  wheelchairAccessible: boolean;
  removeLogo: boolean;
}

export type ChurchListingFormFieldName =
  | keyof ChurchListingFormValues
  | "churchLogo"
  | "churchPhotos";

export interface ChurchListingFormState {
  status: "idle" | "error";
  formError?: string;
  errors: Partial<Record<ChurchListingFormFieldName, string>>;
  values: ChurchListingFormValues;
}

export function createChurchListingFormValues(
  church: ChurchRecord,
  overrides?: Partial<ChurchListingFormValues>,
): ChurchListingFormValues {
  return {
    churchId: overrides?.churchId ?? church.id,
    churchSlug: overrides?.churchSlug ?? church.slug,
    churchName: overrides?.churchName ?? church.name,
    addressLine1: overrides?.addressLine1 ?? church.address.line1,
    addressLine2: overrides?.addressLine2 ?? church.address.line2 ?? "",
    city: overrides?.city ?? church.address.city,
    county: overrides?.county ?? (church.countyId ? "Matagorda County" : ""),
    stateCode: overrides?.stateCode ?? church.address.stateCode,
    postalCode: overrides?.postalCode ?? church.address.postalCode,
    phone: overrides?.phone ?? church.phone,
    email: overrides?.email ?? church.email ?? "",
    websiteUrl: overrides?.websiteUrl ?? church.website ?? "",
    facebookUrl: overrides?.facebookUrl ?? church.socialLinks.facebook ?? "",
    youtubeUrl: overrides?.youtubeUrl ?? church.socialLinks.youtube ?? "",
    instagramUrl: overrides?.instagramUrl ?? church.socialLinks.instagram ?? "",
    clergyName: overrides?.clergyName ?? church.primaryClergyName ?? "",
    additionalLeaders:
      overrides?.additionalLeaders ?? church.additionalLeaders.join("\n"),
    denomination: overrides?.denomination ?? church.denomination,
    specificAffiliation:
      overrides?.specificAffiliation ?? church.specificAffiliation ?? "",
    churchDescription: overrides?.churchDescription ?? church.description,
    statementOfFaith:
      overrides?.statementOfFaith ?? church.statementOfFaith ?? "",
    worshipStyle: overrides?.worshipStyle ?? church.worshipStyle ?? "",
    serviceTimes:
      overrides?.serviceTimes ??
      church.serviceTimes.map((serviceTime) => serviceTime.label).join("\n"),
    languagesOffered:
      overrides?.languagesOffered ?? church.languages.join(", "),
    onlineGivingUrl:
      overrides?.onlineGivingUrl ?? church.onlineGivingUrl ?? "",
    accessibilityDetails:
      overrides?.accessibilityDetails ?? church.accessibilityDetails ?? "",
    visitorParkingDetails:
      overrides?.visitorParkingDetails ?? church.visitorParkingDetails ?? "",
    firstTimeVisitorNotes:
      overrides?.firstTimeVisitorNotes ?? church.firstTimeVisitorNotes ?? "",
    ministryTags:
      overrides?.ministryTags ?? church.ministryTags.map((tag) => tag.label).join(", "),
    spanishServiceAvailable:
      overrides?.spanishServiceAvailable ?? church.features.spanishService,
    livestreamAvailable:
      overrides?.livestreamAvailable ?? church.features.livestream,
    childrenMinistryAvailable:
      overrides?.childrenMinistryAvailable ?? church.features.childrenMinistry,
    youthMinistryAvailable:
      overrides?.youthMinistryAvailable ?? church.features.youthMinistry,
    nurseryCareAvailable:
      overrides?.nurseryCareAvailable ?? church.features.nurseryCare,
    wheelchairAccessible:
      overrides?.wheelchairAccessible ?? church.features.wheelchairAccessible,
    removeLogo: overrides?.removeLogo ?? false,
  };
}

export function createChurchListingFormState(
  church: ChurchRecord,
  overrides?: Partial<ChurchListingFormValues>,
): ChurchListingFormState {
  return {
    status: "idle",
    errors: {},
    values: createChurchListingFormValues(church, overrides),
  };
}
