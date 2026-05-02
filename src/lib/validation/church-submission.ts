import { imageSize } from "image-size";
import { z } from "zod";

import { denominationOptions, worshipStyleOptions } from "@/lib/data/options";
import type {
  CreateChurchSubmissionInput,
  SubmissionFieldErrorKey,
  SubmissionFormValues,
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

const submissionSchema = z.object({
  churchName: z.string().min(2, "Enter the church name."),
  addressLine1: z.string().min(4, "Enter the church address."),
  addressLine2: optionalTrimmedText,
  city: z.string().min(2, "Enter the city."),
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
  denomination: z.enum(denominationOptions, {
    message: "Choose a denomination or tradition.",
  }),
  churchDescription: z
    .string()
    .min(20, "Add a short description.")
    .max(300, "Keep the description at 300 characters or less."),
  serviceTimes: z
    .array(z.string().min(2))
    .min(1, "Add at least one service time."),
  primaryContactName: z.string().min(2, "Enter the primary contact name."),
  primaryContactEmail: z.string().email("Enter a valid primary contact email."),
  primaryContactRole: z.string().min(2, "Enter the primary contact role or title."),
  primaryContactPhone: optionalPhone,
  websiteUrl: optionalUrl,
  facebookUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  instagramUrl: optionalUrl,
  clergyName: optionalTrimmedText,
  additionalLeaders: z.array(z.string()).default([]),
  specificAffiliation: optionalTrimmedText,
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
  languages: z.array(z.string()).default([]),
  spanishServiceAvailable: z.boolean(),
  livestreamAvailable: z.boolean(),
  onlineGivingUrl: optionalUrl,
  childrenMinistryAvailable: z.boolean(),
  youthMinistryAvailable: z.boolean(),
  nurseryCareAvailable: z.boolean(),
  wheelchairAccessible: z.boolean(),
  accessibilityDetails: optionalTrimmedText,
  visitorParkingDetails: optionalTrimmedText,
  firstTimeVisitorNotes: optionalTrimmedText,
  ministryTags: z.array(z.string()).default([]),
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

function createValues(formData: FormData): SubmissionFormValues {
  return {
    churchName: getString(formData, "churchName"),
    addressLine1: getString(formData, "addressLine1"),
    addressLine2: getString(formData, "addressLine2"),
    city: getString(formData, "city"),
    stateCode: getString(formData, "stateCode").toUpperCase(),
    postalCode: getString(formData, "postalCode"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    denomination: getString(formData, "denomination"),
    churchDescription: getString(formData, "churchDescription"),
    serviceTimes: getString(formData, "serviceTimes"),
    primaryContactName: getString(formData, "primaryContactName"),
    primaryContactEmail: getString(formData, "primaryContactEmail"),
    primaryContactRole: getString(formData, "primaryContactRole"),
    primaryContactPhone: getString(formData, "primaryContactPhone"),
    websiteUrl: getString(formData, "websiteUrl"),
    facebookUrl: getString(formData, "facebookUrl"),
    youtubeUrl: getString(formData, "youtubeUrl"),
    instagramUrl: getString(formData, "instagramUrl"),
    clergyName: getString(formData, "clergyName"),
    additionalLeaders: getString(formData, "additionalLeaders"),
    specificAffiliation: getString(formData, "specificAffiliation"),
    statementOfFaith: getString(formData, "statementOfFaith"),
    worshipStyle: getString(formData, "worshipStyle"),
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
  };
}

function createErrorMap(error: z.ZodError): Partial<Record<SubmissionFieldErrorKey, string>> {
  const errorMap: Partial<Record<SubmissionFieldErrorKey, string>> = {};

  for (const issue of error.issues) {
    const fieldKey = issue.path[0] as SubmissionFieldErrorKey | undefined;

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
        kind: fieldKey === "churchLogo" ? ("logo" as const) : ("photo" as const),
        originalName: file.name,
        extension: deriveUploadExtension(file.name, file.type),
        mimeType: file.type,
        size: file.size,
        width: dimensions.width,
        height: dimensions.height,
        buffer,
      },
      error: undefined,
    };
  } catch {
    return {
      upload: undefined,
      error: `${fieldKey === "churchLogo" ? "Logo" : "Photo"} could not be read. Please try another image.`,
    };
  }
}

export async function validateChurchSubmissionFormData(formData: FormData) {
  const values = createValues(formData);
  const schemaResult = submissionSchema.safeParse({
    churchName: values.churchName,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2,
    city: values.city,
    stateCode: values.stateCode,
    postalCode: values.postalCode,
    phone: values.phone,
    email: values.email,
    denomination: values.denomination,
    churchDescription: values.churchDescription,
    serviceTimes: splitLines(values.serviceTimes),
    primaryContactName: values.primaryContactName,
    primaryContactEmail: values.primaryContactEmail,
    primaryContactRole: values.primaryContactRole,
    primaryContactPhone: values.primaryContactPhone,
    websiteUrl: values.websiteUrl,
    facebookUrl: values.facebookUrl,
    youtubeUrl: values.youtubeUrl,
    instagramUrl: values.instagramUrl,
    clergyName: values.clergyName,
    additionalLeaders: splitLines(values.additionalLeaders),
    specificAffiliation: values.specificAffiliation,
    statementOfFaith: values.statementOfFaith,
    worshipStyle: values.worshipStyle,
    languages: splitCommaSeparatedValues(values.languagesOffered),
    spanishServiceAvailable: values.spanishServiceAvailable,
    livestreamAvailable: values.livestreamAvailable,
    onlineGivingUrl: values.onlineGivingUrl,
    childrenMinistryAvailable: values.childrenMinistryAvailable,
    youthMinistryAvailable: values.youthMinistryAvailable,
    nurseryCareAvailable: values.nurseryCareAvailable,
    wheelchairAccessible: values.wheelchairAccessible,
    accessibilityDetails: values.accessibilityDetails,
    visitorParkingDetails: values.visitorParkingDetails,
    firstTimeVisitorNotes: values.firstTimeVisitorNotes,
    ministryTags: splitCommaSeparatedValues(values.ministryTags),
  });

  const errors = schemaResult.success ? {} : createErrorMap(schemaResult.error);

  const logoCandidate = formData.get("churchLogo");
  const churchLogo =
    logoCandidate instanceof File && logoCandidate.size > 0 ? logoCandidate : undefined;
  const photoCandidates = formData
    .getAll("churchPhotos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (photoCandidates.length > 4) {
    errors.churchPhotos = "Upload up to 4 church photos.";
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

  if (Object.keys(errors).length > 0 || !schemaResult.success) {
    return {
      success: false as const,
      values,
      errors,
      formError:
        "Please review the highlighted fields and try submitting your church again.",
    };
  }

  const parsedData: CreateChurchSubmissionInput = {
    churchName: schemaResult.data.churchName,
    addressLine1: schemaResult.data.addressLine1,
    addressLine2: schemaResult.data.addressLine2,
    city: schemaResult.data.city,
    stateCode: schemaResult.data.stateCode,
    postalCode: schemaResult.data.postalCode,
    phone: schemaResult.data.phone,
    email: schemaResult.data.email,
    denomination: schemaResult.data.denomination,
    shortDescription: schemaResult.data.churchDescription,
    serviceTimes: schemaResult.data.serviceTimes,
    primaryContactName: schemaResult.data.primaryContactName,
    primaryContactEmail: schemaResult.data.primaryContactEmail,
    primaryContactRole: schemaResult.data.primaryContactRole,
    primaryContactPhone: schemaResult.data.primaryContactPhone,
    websiteUrl: schemaResult.data.websiteUrl,
    facebookUrl: schemaResult.data.facebookUrl,
    youtubeUrl: schemaResult.data.youtubeUrl,
    instagramUrl: schemaResult.data.instagramUrl,
    clergyName: schemaResult.data.clergyName,
    additionalLeaders: schemaResult.data.additionalLeaders,
    specificAffiliation: schemaResult.data.specificAffiliation,
    statementOfFaith: schemaResult.data.statementOfFaith,
    worshipStyle: schemaResult.data.worshipStyle,
    languages: schemaResult.data.languages,
    spanishServiceAvailable: schemaResult.data.spanishServiceAvailable,
    livestreamAvailable: schemaResult.data.livestreamAvailable,
    onlineGivingUrl: schemaResult.data.onlineGivingUrl,
    childrenMinistryAvailable: schemaResult.data.childrenMinistryAvailable,
    youthMinistryAvailable: schemaResult.data.youthMinistryAvailable,
    nurseryCareAvailable: schemaResult.data.nurseryCareAvailable,
    wheelchairAccessible: schemaResult.data.wheelchairAccessible,
    accessibilityDetails: schemaResult.data.accessibilityDetails,
    visitorParkingDetails: schemaResult.data.visitorParkingDetails,
    firstTimeVisitorNotes: schemaResult.data.firstTimeVisitorNotes,
    ministryTags: schemaResult.data.ministryTags,
  };

  return {
    success: true as const,
    values,
    data: parsedData,
    uploads: {
      churchLogo: validatedLogo,
      churchPhotos: validatedPhotos,
    },
  };
}
