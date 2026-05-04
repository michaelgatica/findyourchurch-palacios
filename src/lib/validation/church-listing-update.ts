import { imageSize } from "image-size";
import { z } from "zod";

import { denominationOptions, worshipStyleOptions } from "@/lib/data/options";
import {
  isReservedChurchShareSlug,
  normalizeChurchShareSlug,
} from "@/lib/config/site";
import {
  findCityByNameAndStateCode,
  findCountyByName,
  getStateByCode,
} from "@/lib/data/locations";
import type {
  ChurchListingFormFieldName,
  ChurchListingFormValues,
} from "@/lib/portal-church-form-state";
import type {
  ChurchPhoto,
  ChurchRecord,
} from "@/lib/types/directory";

const acceptedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumUploadSizeInBytes = 8 * 1024 * 1024;
const allowedStateCodes = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

const optionalTrimmedText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  },
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  },
  z.string().url("Enter a valid URL.").optional(),
);

const optionalPhone = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  },
  z
    .string()
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "Enter a valid phone number.",
    )
    .optional(),
);

const listingSchema = z.object({
  churchId: z.string().min(1),
  churchSlug: z.string().min(1),
  churchName: z.string().min(2, "Enter the church name."),
  customShareSlug: optionalTrimmedText,
  addressLine1: z.string().min(4, "Enter the church address."),
  addressLine2: optionalTrimmedText,
  city: z.string().min(2, "Enter the city."),
  county: optionalTrimmedText,
  stateCode: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => allowedStateCodes.has(value), "Enter a valid two-letter state code."),
  postalCode: z
    .string()
    .regex(/^\d{5}(?:-\d{4})?$/, "Enter a valid ZIP code."),
  phone: z
    .string()
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "Enter a valid phone number.",
    ),
  email: z.string().email("Enter a valid church email address."),
  websiteUrl: optionalUrl,
  facebookUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  instagramUrl: optionalUrl,
  clergyName: optionalTrimmedText,
  additionalLeaders: z.array(z.string()).default([]),
  denomination: z.enum(denominationOptions, {
    message: "Choose a denomination or tradition.",
  }),
  specificAffiliation: optionalTrimmedText,
  churchDescription: z
    .string()
    .min(20, "Add a short description.")
    .max(300, "Keep the description at 300 characters or less."),
  statementOfFaith: z
    .preprocess(
      (value) => {
        if (typeof value !== "string") {
          return undefined;
        }

        const trimmedValue = value.trim();
        return trimmedValue.length > 0 ? trimmedValue : undefined;
      },
      z
        .string()
        .max(200, "Keep the statement of faith at 200 characters or less.")
        .optional(),
    ),
  worshipStyle: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmedValue = value.trim();
      return trimmedValue.length > 0 ? trimmedValue : undefined;
    },
    z.enum(worshipStyleOptions).optional(),
  ),
  serviceTimes: z
    .array(z.string().min(2))
    .min(1, "Add at least one service time."),
  languages: z.array(z.string()).default([]),
  onlineGivingUrl: optionalUrl,
  accessibilityDetails: optionalTrimmedText,
  visitorParkingDetails: optionalTrimmedText,
  firstTimeVisitorNotes: optionalTrimmedText,
  ministryTags: z.array(z.string()).default([]),
  spanishServiceAvailable: z.boolean(),
  livestreamAvailable: z.boolean(),
  childrenMinistryAvailable: z.boolean(),
  youthMinistryAvailable: z.boolean(),
  nurseryCareAvailable: z.boolean(),
  wheelchairAccessible: z.boolean(),
  removeLogo: z.boolean(),
});

function getString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(formData: FormData, fieldName: string) {
  return formData.get(fieldName) === "on";
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitCommaSeparatedValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function deriveUploadExtension(fileName: string, mimeType: string) {
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedFileName.endsWith(".png")) {
    return ".png";
  }

  if (normalizedFileName.endsWith(".jpg") || normalizedFileName.endsWith(".jpeg")) {
    return normalizedFileName.endsWith(".jpg") ? ".jpg" : ".jpeg";
  }

  if (normalizedFileName.endsWith(".webp")) {
    return ".webp";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}

function createValues(formData: FormData, currentChurch: ChurchRecord): ChurchListingFormValues {
  return {
    churchId: getString(formData, "churchId") || currentChurch.id,
    churchSlug: getString(formData, "churchSlug") || currentChurch.slug,
    churchName: getString(formData, "churchName"),
    customShareSlug: getString(formData, "customShareSlug"),
    addressLine1: getString(formData, "addressLine1"),
    addressLine2: getString(formData, "addressLine2"),
    city: getString(formData, "city"),
    county: getString(formData, "county"),
    stateCode: getString(formData, "stateCode").toUpperCase(),
    postalCode: getString(formData, "postalCode"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    websiteUrl: getString(formData, "websiteUrl"),
    facebookUrl: getString(formData, "facebookUrl"),
    youtubeUrl: getString(formData, "youtubeUrl"),
    instagramUrl: getString(formData, "instagramUrl"),
    clergyName: getString(formData, "clergyName"),
    additionalLeaders: getString(formData, "additionalLeaders"),
    denomination: getString(formData, "denomination"),
    specificAffiliation: getString(formData, "specificAffiliation"),
    churchDescription: getString(formData, "churchDescription"),
    statementOfFaith: getString(formData, "statementOfFaith"),
    worshipStyle: getString(formData, "worshipStyle"),
    serviceTimes: getString(formData, "serviceTimes"),
    languagesOffered: getString(formData, "languagesOffered"),
    onlineGivingUrl: getString(formData, "onlineGivingUrl"),
    accessibilityDetails: getString(formData, "accessibilityDetails"),
    visitorParkingDetails: getString(formData, "visitorParkingDetails"),
    firstTimeVisitorNotes: getString(formData, "firstTimeVisitorNotes"),
    ministryTags: getString(formData, "ministryTags"),
    spanishServiceAvailable: getBoolean(formData, "spanishServiceAvailable"),
    livestreamAvailable: getBoolean(formData, "livestreamAvailable"),
    childrenMinistryAvailable: getBoolean(formData, "childrenMinistryAvailable"),
    youthMinistryAvailable: getBoolean(formData, "youthMinistryAvailable"),
    nurseryCareAvailable: getBoolean(formData, "nurseryCareAvailable"),
    wheelchairAccessible: getBoolean(formData, "wheelchairAccessible"),
    removeLogo: getBoolean(formData, "removeLogo"),
  };
}

function createErrorMap(error: z.ZodError) {
  const errorMap: Partial<Record<ChurchListingFormFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldKey = issue.path[0] as ChurchListingFormFieldName | undefined;

    if (!fieldKey || errorMap[fieldKey]) {
      continue;
    }

    errorMap[fieldKey] = issue.message;
  }

  return errorMap;
}

export interface ValidatedUploadFile {
  kind: "logo" | "photo";
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  buffer: Buffer;
}

async function validateImageFile(
  fieldKey: "churchLogo" | "churchPhotos",
  file: File,
  {
    maximumWidth,
    maximumHeight,
  }: {
    maximumWidth?: number;
    maximumHeight?: number;
  } = {},
): Promise<{
  upload?: ValidatedUploadFile;
  error?: string;
}> {
  if (file.size === 0) {
    return { upload: undefined, error: undefined };
  }

  if (!acceptedImageMimeTypes.has(file.type)) {
    return {
      upload: undefined,
      error: `${fieldKey === "churchLogo" ? "Logo" : "Photo"} must be a PNG, JPG, or WebP image.`,
    };
  }

  if (file.size > maximumUploadSizeInBytes) {
    return {
      upload: undefined,
      error: `${fieldKey === "churchLogo" ? "Logo" : "Photo"} must be 8 MB or smaller.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const dimensions = imageSize(buffer);

    if (maximumWidth && (dimensions.width ?? 0) > maximumWidth) {
      return {
        upload: undefined,
        error: `Logo width must be ${maximumWidth}px or smaller.`,
      };
    }

    if (maximumHeight && (dimensions.height ?? 0) > maximumHeight) {
      return {
        upload: undefined,
        error: `Logo height must be ${maximumHeight}px or smaller.`,
      };
    }

    return {
      upload: {
        kind: fieldKey === "churchLogo" ? "logo" : "photo",
        originalName: file.name,
        extension: deriveUploadExtension(file.name, file.type),
        mimeType: file.type,
        size: file.size,
        width: dimensions.width,
        height: dimensions.height,
        buffer,
      },
    };
  } catch {
    return {
      upload: undefined,
      error: `${fieldKey === "churchLogo" ? "Logo" : "Photo"} could not be read. Please try another image.`,
    };
  }
}

function getSelectedExistingPhotos(formData: FormData, currentChurch: ChurchRecord) {
  const selectedPhotos = currentChurch.photos
    .filter((photo) => formData.get(`keepPhoto_${photo.id}`) === "on")
    .map((photo) => {
      const orderValue = Number.parseInt(getString(formData, `photoOrder_${photo.id}`), 10);

      return {
        ...photo,
        sortOrder: Number.isFinite(orderValue) && orderValue > 0 ? orderValue : photo.sortOrder,
      };
    })
    .sort((leftPhoto, rightPhoto) => leftPhoto.sortOrder - rightPhoto.sortOrder)
    .map((photo, index) => ({
      ...photo,
      sortOrder: index + 1,
    }));

  return selectedPhotos;
}

export interface ValidatedChurchListingUpdateInput {
  churchId: string;
  churchSlug: string;
  churchName: string;
  customShareSlug?: string | null;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  stateCode: string;
  postalCode: string;
  phone: string;
  email: string;
  websiteUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  clergyName?: string;
  additionalLeaders: string[];
  denomination: string;
  specificAffiliation?: string;
  shortDescription: string;
  statementOfFaith?: string;
  worshipStyle?: string;
  serviceTimes: string[];
  languages: string[];
  onlineGivingUrl?: string;
  accessibilityDetails?: string;
  visitorParkingDetails?: string;
  firstTimeVisitorNotes?: string;
  ministryTags: string[];
  spanishServiceAvailable: boolean;
  livestreamAvailable: boolean;
  childrenMinistryAvailable: boolean;
  youthMinistryAvailable: boolean;
  nurseryCareAvailable: boolean;
  wheelchairAccessible: boolean;
  removeLogo: boolean;
  selectedExistingPhotos: ChurchPhoto[];
  cityId: string | null;
  countyId: string | null;
  stateId: string | null;
}

export async function validateChurchListingUpdateFormData(
  formData: FormData,
  currentChurch: ChurchRecord,
) {
  const values = createValues(formData, currentChurch);
  const schemaResult = listingSchema.safeParse({
    churchId: values.churchId,
    churchSlug: values.churchSlug,
    churchName: values.churchName,
    customShareSlug: values.customShareSlug,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2,
    city: values.city,
    county: values.county,
    stateCode: values.stateCode,
    postalCode: values.postalCode,
    phone: values.phone,
    email: values.email,
    websiteUrl: values.websiteUrl,
    facebookUrl: values.facebookUrl,
    youtubeUrl: values.youtubeUrl,
    instagramUrl: values.instagramUrl,
    clergyName: values.clergyName,
    additionalLeaders: splitLines(values.additionalLeaders),
    denomination: values.denomination,
    specificAffiliation: values.specificAffiliation,
    churchDescription: values.churchDescription,
    statementOfFaith: values.statementOfFaith,
    worshipStyle: values.worshipStyle,
    serviceTimes: splitLines(values.serviceTimes),
    languages: splitCommaSeparatedValues(values.languagesOffered),
    onlineGivingUrl: values.onlineGivingUrl,
    accessibilityDetails: values.accessibilityDetails,
    visitorParkingDetails: values.visitorParkingDetails,
    firstTimeVisitorNotes: values.firstTimeVisitorNotes,
    ministryTags: splitCommaSeparatedValues(values.ministryTags),
    spanishServiceAvailable: values.spanishServiceAvailable,
    livestreamAvailable: values.livestreamAvailable,
    childrenMinistryAvailable: values.childrenMinistryAvailable,
    youthMinistryAvailable: values.youthMinistryAvailable,
    nurseryCareAvailable: values.nurseryCareAvailable,
    wheelchairAccessible: values.wheelchairAccessible,
    removeLogo: values.removeLogo,
  });

  const errors = schemaResult.success ? {} : createErrorMap(schemaResult.error);
  const normalizedCustomShareSlug = normalizeChurchShareSlug(values.customShareSlug);

  if (values.customShareSlug && !normalizedCustomShareSlug) {
    errors.customShareSlug = "Enter a valid custom share link using letters, numbers, or hyphens.";
  } else if (normalizedCustomShareSlug && normalizedCustomShareSlug.length < 3) {
    errors.customShareSlug = "Use at least 3 characters for a custom share link.";
  } else if (normalizedCustomShareSlug && isReservedChurchShareSlug(normalizedCustomShareSlug)) {
    errors.customShareSlug = "That custom share link is reserved. Please choose another.";
  }
  const selectedExistingPhotos = getSelectedExistingPhotos(formData, currentChurch);
  const logoCandidate = formData.get("churchLogo");
  const churchLogo =
    logoCandidate instanceof File && logoCandidate.size > 0 ? logoCandidate : undefined;
  const photoCandidates = formData
    .getAll("churchPhotos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (selectedExistingPhotos.length + photoCandidates.length > 4) {
    errors.churchPhotos = "Keep or upload up to 4 church photos total.";
  }

  let validatedLogo: ValidatedUploadFile | undefined;
  const validatedPhotos: ValidatedUploadFile[] = [];

  if (churchLogo) {
    const logoValidation = await validateImageFile("churchLogo", churchLogo, {
      maximumWidth: 512,
      maximumHeight: 512,
    });

    if (logoValidation.error) {
      errors.churchLogo = logoValidation.error;
    } else {
      validatedLogo = logoValidation.upload;
    }
  }

  if (!errors.churchPhotos) {
    for (const photoFile of photoCandidates.slice(0, 4)) {
      const photoValidation = await validateImageFile("churchPhotos", photoFile);

      if (photoValidation.error) {
        errors.churchPhotos = photoValidation.error;
        break;
      }

      if (photoValidation.upload) {
        validatedPhotos.push(photoValidation.upload);
      }
    }
  }

  if (!schemaResult.success || Object.keys(errors).length > 0) {
    return {
      success: false as const,
      values,
      errors,
      formError:
        "Please review the highlighted fields and try updating the church listing again.",
    };
  }

  const matchedCity = findCityByNameAndStateCode(
    schemaResult.data.city,
    schemaResult.data.stateCode,
  );
  const matchedState = getStateByCode(schemaResult.data.stateCode);
  const matchedCounty = schemaResult.data.county
    ? findCountyByName(schemaResult.data.county)
    : null;

  return {
    success: true as const,
    values,
    data: {
      churchId: schemaResult.data.churchId,
      churchSlug: schemaResult.data.churchSlug,
      churchName: schemaResult.data.churchName,
      customShareSlug: normalizedCustomShareSlug,
      addressLine1: schemaResult.data.addressLine1,
      addressLine2: schemaResult.data.addressLine2,
      city: schemaResult.data.city,
      county: schemaResult.data.county,
      stateCode: schemaResult.data.stateCode,
      postalCode: schemaResult.data.postalCode,
      phone: schemaResult.data.phone,
      email: schemaResult.data.email,
      websiteUrl: schemaResult.data.websiteUrl,
      facebookUrl: schemaResult.data.facebookUrl,
      youtubeUrl: schemaResult.data.youtubeUrl,
      instagramUrl: schemaResult.data.instagramUrl,
      clergyName: schemaResult.data.clergyName,
      additionalLeaders: schemaResult.data.additionalLeaders,
      denomination: schemaResult.data.denomination,
      specificAffiliation: schemaResult.data.specificAffiliation,
      shortDescription: schemaResult.data.churchDescription,
      statementOfFaith: schemaResult.data.statementOfFaith,
      worshipStyle: schemaResult.data.worshipStyle,
      serviceTimes: schemaResult.data.serviceTimes,
      languages: schemaResult.data.languages,
      onlineGivingUrl: schemaResult.data.onlineGivingUrl,
      accessibilityDetails: schemaResult.data.accessibilityDetails,
      visitorParkingDetails: schemaResult.data.visitorParkingDetails,
      firstTimeVisitorNotes: schemaResult.data.firstTimeVisitorNotes,
      ministryTags: schemaResult.data.ministryTags,
      spanishServiceAvailable: schemaResult.data.spanishServiceAvailable,
      livestreamAvailable: schemaResult.data.livestreamAvailable,
      childrenMinistryAvailable: schemaResult.data.childrenMinistryAvailable,
      youthMinistryAvailable: schemaResult.data.youthMinistryAvailable,
      nurseryCareAvailable: schemaResult.data.nurseryCareAvailable,
      wheelchairAccessible: schemaResult.data.wheelchairAccessible,
      removeLogo: schemaResult.data.removeLogo,
      selectedExistingPhotos,
      cityId: matchedCity?.id ?? currentChurch.cityId ?? null,
      countyId:
        matchedCounty?.id ??
        matchedCity?.countyId ??
        currentChurch.countyId ??
        null,
      stateId: matchedState?.id ?? currentChurch.stateId ?? null,
    } satisfies ValidatedChurchListingUpdateInput,
    uploads: {
      churchLogo: validatedLogo,
      churchPhotos: validatedPhotos,
    },
  };
}
