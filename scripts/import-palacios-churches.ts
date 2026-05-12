import { existsSync, readFileSync } from "fs";
import path from "path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

import {
  createServiceTime,
  createSlug,
  createTag,
  mapChurchRecordToChurchDocument,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import {
  findCityByNameAndStateCode,
  findCountyByName,
  getStateByCode,
} from "@/lib/data/locations";
import {
  listChurchesFromFirebase,
  saveChurchDocumentToFirebase,
} from "@/lib/repositories/firebase-church-repository";
import {
  churchStatuses,
  type ChurchPhoto,
  type ChurchRecord,
  type ServiceTime,
} from "@/lib/types/directory";

loadEnv({
  path: ".env.local",
});

const filePathFlagIndex = process.argv.findIndex((argument) => argument === "--input");
const inputFilePath =
  filePathFlagIndex >= 0 && process.argv[filePathFlagIndex + 1]
    ? process.argv[filePathFlagIndex + 1]
    : "data/palacios-churches.json";
const resolvedInputFilePath = path.resolve(process.cwd(), inputFilePath);
const overwriteExisting = process.argv.includes("--overwrite");
const dryRun = process.argv.includes("--dry-run");
const confirmImport = process.argv.includes("--confirm");

const importedServiceTimeSchema = z.union([
  z.string().min(1),
  z.object({
    label: z.string().min(1),
    dayLabel: z.string().optional(),
    startTime: z.string().optional(),
    notes: z.string().optional(),
    isPrimary: z.boolean().optional(),
  }),
]);

const importedPhotoSchema = z.union([
  z.string().min(1),
  z.object({
    src: z.string().min(1),
    alt: z.string().optional(),
    caption: z.string().optional(),
    sortOrder: z.number().int().positive().optional(),
  }),
]);

const importedChurchSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  status: z.enum(churchStatuses).optional().default("published"),
  name: z.string().min(1),
  denomination: z.string().min(1),
  specificAffiliation: z.string().optional(),
  clergyLabel: z.string().optional(),
  primaryClergyName: z.string().optional(),
  pastorName: z.string().optional(),
  additionalLeaders: z.array(z.string()).optional().default([]),
  description: z.string().min(1).max(500),
  statementOfFaith: z.string().max(200).optional(),
  serviceTimes: z.array(importedServiceTimeSchema).min(1),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1).default("Palacios"),
    county: z.string().optional(),
    countyId: z.string().optional(),
    stateCode: z.string().min(2).max(2).default("TX"),
    postalCode: z.string().min(5),
    countryCode: z.literal("US").optional().default("US"),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  }),
  phone: z.string().optional().default(""),
  email: z.email().optional(),
  website: z.url().optional(),
  socialLinks: z
    .object({
      facebook: z.url().optional(),
      instagram: z.url().optional(),
      youtube: z.url().optional(),
    })
    .optional()
    .default({}),
  worshipStyle: z.string().optional(),
  languages: z.array(z.string()).optional().default([]),
  ministries: z.array(z.string()).optional().default([]),
  ministryTags: z.array(z.string()).optional().default([]),
  childrenMinistry: z.boolean().optional().default(false),
  youthMinistry: z.boolean().optional().default(false),
  nurseryCare: z.boolean().optional().default(false),
  spanishService: z.boolean().optional().default(false),
  livestream: z.boolean().optional().default(false),
  wheelchairAccessible: z.boolean().optional().default(false),
  accessibilityDetails: z.string().optional(),
  visitorParkingDetails: z.string().optional(),
  visitorParking: z.string().optional(),
  firstTimeVisitorNotes: z.string().optional(),
  livestreamDetails: z.string().optional(),
  livestreamInfo: z.string().optional(),
  onlineGivingUrl: z.url().optional(),
  autoPublishUpdates: z.boolean().optional(),
  lastVerifiedAt: z.string().optional(),
  logoSrc: z.string().optional(),
  logoUrl: z.string().optional(),
  logoPath: z.string().optional(),
  photos: z.array(importedPhotoSchema).optional().default([]),
  photoUrls: z.array(z.string()).optional().default([]),
});

const importedChurchesSchema = z.array(importedChurchSchema);

type ImportedChurch = z.infer<typeof importedChurchSchema>;

function ensureInputFileExists() {
  if (!existsSync(resolvedInputFilePath)) {
    throw new Error(
      `Input file not found at "${resolvedInputFilePath}". Create data/palacios-churches.json or pass --input <file>.`,
    );
  }
}

function parseImportedChurches() {
  ensureInputFileExists();
  const rawFileContents = readFileSync(resolvedInputFilePath, "utf8");
  const parsedJson = JSON.parse(rawFileContents) as unknown;
  return importedChurchesSchema.parse(parsedJson);
}

function mapImportedServiceTimes(serviceTimes: ImportedChurch["serviceTimes"]): ServiceTime[] {
  return serviceTimes.map((serviceTime, index) => {
    if (typeof serviceTime === "string") {
      return createServiceTime(serviceTime, index);
    }

    return {
      id: `service-time-${index + 1}`,
      label: serviceTime.label,
      dayLabel: serviceTime.dayLabel,
      startTime: serviceTime.startTime,
      notes: serviceTime.notes,
      isPrimary: serviceTime.isPrimary ?? index === 0,
    };
  });
}

function mapImportedPhotos(churchName: string, importedChurch: ImportedChurch): ChurchPhoto[] {
  const normalizedPhotoValues = [
    ...importedChurch.photos,
    ...importedChurch.photoUrls,
  ];

  return normalizedPhotoValues.slice(0, 4).map((photoValue, index) => {
    if (typeof photoValue === "string") {
      return {
        id: `photo-${index + 1}`,
        src: photoValue,
        alt: `${churchName} church photo ${index + 1}`,
        sortOrder: index + 1,
      };
    }

    return {
      id: `photo-${index + 1}`,
      src: photoValue.src,
      alt: photoValue.alt ?? `${churchName} church photo ${index + 1}`,
      caption: photoValue.caption,
      sortOrder: photoValue.sortOrder ?? index + 1,
    };
  });
}

function buildChurchRecord(
  importedChurch: ImportedChurch,
  existingChurch?: ChurchRecord,
): ChurchRecord {
  const slug = importedChurch.slug ?? createSlug(importedChurch.name);
  const matchedCity =
    findCityByNameAndStateCode(importedChurch.address.city, importedChurch.address.stateCode) ??
    null;
  const matchedState = getStateByCode(importedChurch.address.stateCode) ?? null;
  const matchedCounty =
    importedChurch.address.countyId
      ? { id: importedChurch.address.countyId }
      : importedChurch.address.county
        ? findCountyByName(importedChurch.address.county)
        : null;
  const now = new Date().toISOString();
  const normalizedMinistryLabels =
    importedChurch.ministryTags.length > 0
      ? importedChurch.ministryTags
      : importedChurch.ministries;

  return {
    id: existingChurch?.id ?? importedChurch.id ?? slug,
    slug,
    status: importedChurch.status,
    cityId: matchedCity?.id ?? existingChurch?.cityId ?? null,
    countyId: matchedCounty?.id ?? matchedCity?.countyId ?? existingChurch?.countyId ?? null,
    stateId: matchedState?.id ?? matchedCity?.stateId ?? existingChurch?.stateId ?? null,
    name: importedChurch.name,
    logoSrc:
      importedChurch.logoSrc ??
      importedChurch.logoUrl ??
      importedChurch.logoPath ??
      existingChurch?.logoSrc ??
      null,
    photos: mapImportedPhotos(importedChurch.name, importedChurch),
    denomination: importedChurch.denomination,
    specificAffiliation: importedChurch.specificAffiliation,
    clergyLabel: importedChurch.clergyLabel,
    primaryClergyName:
      importedChurch.primaryClergyName ?? importedChurch.pastorName ?? existingChurch?.primaryClergyName,
    additionalLeaders: importedChurch.additionalLeaders,
    description: importedChurch.description,
    statementOfFaith: importedChurch.statementOfFaith,
    serviceTimes: mapImportedServiceTimes(importedChurch.serviceTimes),
    address: {
      line1: importedChurch.address.line1,
      line2: importedChurch.address.line2,
      city: importedChurch.address.city,
      stateCode: importedChurch.address.stateCode,
      postalCode: importedChurch.address.postalCode,
      countyId: matchedCounty?.id ?? matchedCity?.countyId ?? existingChurch?.address.countyId ?? null,
      countryCode: importedChurch.address.countryCode ?? "US",
      latitude: importedChurch.address.latitude ?? existingChurch?.address.latitude ?? null,
      longitude: importedChurch.address.longitude ?? existingChurch?.address.longitude ?? null,
    },
    phone: importedChurch.phone.trim() || existingChurch?.phone || "",
    email: importedChurch.email ?? existingChurch?.email,
    website: importedChurch.website,
    socialLinks: importedChurch.socialLinks,
    worshipStyle: importedChurch.worshipStyle,
    languages: importedChurch.languages,
    features: {
      childrenMinistry: importedChurch.childrenMinistry,
      youthMinistry: importedChurch.youthMinistry,
      nurseryCare: importedChurch.nurseryCare,
      spanishService: importedChurch.spanishService,
      livestream: importedChurch.livestream,
      wheelchairAccessible: importedChurch.wheelchairAccessible,
    },
    accessibilityDetails: importedChurch.accessibilityDetails,
    visitorParkingDetails:
      importedChurch.visitorParkingDetails ?? importedChurch.visitorParking,
    firstTimeVisitorNotes: importedChurch.firstTimeVisitorNotes,
    livestreamDetails: importedChurch.livestreamDetails ?? importedChurch.livestreamInfo,
    onlineGivingUrl: importedChurch.onlineGivingUrl,
    ministryTags: normalizedMinistryLabels.map(createTag),
    lastVerifiedAt: importedChurch.lastVerifiedAt ?? existingChurch?.lastVerifiedAt ?? null,
    createdAt: existingChurch?.createdAt ?? now,
    updatedAt: now,
    publishedAt:
      importedChurch.status === "published"
        ? existingChurch?.publishedAt ?? now
        : existingChurch?.publishedAt ?? null,
    primaryRepresentativeId: existingChurch?.primaryRepresentativeId ?? null,
    autoPublishUpdates: importedChurch.autoPublishUpdates ?? existingChurch?.autoPublishUpdates ?? false,
    isSeedContent: false,
  };
}

function createDuplicateKey(church: {
  name: string;
  address: { line1: string; city: string; stateCode: string };
}) {
  return [
    church.name.trim().toLowerCase(),
    church.address.line1.trim().toLowerCase(),
    church.address.city.trim().toLowerCase(),
    church.address.stateCode.trim().toLowerCase(),
  ].join("|");
}

async function run() {
  if (!dryRun && !confirmImport) {
    throw new Error(
      "Refusing to import real church data without --confirm or --dry-run. Review the import preview first, then rerun with --confirm when ready.",
    );
  }

  const importedChurches = parseImportedChurches();
  const existingChurches = await listChurchesFromFirebase();
  const existingChurchesBySlug = new Map(existingChurches.map((church) => [church.slug, church]));
  const existingChurchesByDuplicateKey = new Map(
    existingChurches.map((church) => [createDuplicateKey(church), church]),
  );
  const summary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    duplicates: [] as string[],
  };

  console.log(
    `Preparing to import ${importedChurches.length} church record(s) from "${resolvedInputFilePath}".`,
  );
  console.log(
    overwriteExisting
      ? "Overwrite mode is ON. Matching existing churches will be updated."
      : "Overwrite mode is OFF. Potential duplicates will be skipped.",
  );
  console.log(
    dryRun
      ? "Dry-run mode is ON. No records will be written."
      : "Confirm mode is ON. Matching records will be written to Firebase.",
  );

  for (const importedChurch of importedChurches) {
    const importedSlug = importedChurch.slug ?? createSlug(importedChurch.name);
    const duplicateKey = createDuplicateKey({
      name: importedChurch.name,
      address: importedChurch.address,
    });
    const existingChurch =
      existingChurchesBySlug.get(importedSlug) ?? existingChurchesByDuplicateKey.get(duplicateKey);

    if (existingChurch && !overwriteExisting) {
      summary.skipped += 1;
      summary.duplicates.push(
        `${importedChurch.name} -> existing church "${existingChurch.name}" (${existingChurch.id})`,
      );
      continue;
    }

    const churchRecord = buildChurchRecord(importedChurch, existingChurch);

    if (dryRun) {
      console.log(
        `[dry-run] ${existingChurch ? "update" : "import"} ${churchRecord.name} -> ${churchRecord.status}`,
      );
    } else {
      await saveChurchDocumentToFirebase(
        stripUndefinedDeep(mapChurchRecordToChurchDocument(churchRecord)),
      );
    }

    if (existingChurch) {
      summary.updated += 1;
    } else {
      summary.imported += 1;
    }

    existingChurchesBySlug.set(churchRecord.slug, churchRecord);
    existingChurchesByDuplicateKey.set(createDuplicateKey(churchRecord), churchRecord);
  }

  console.log(JSON.stringify(summary, null, 2));

  if (summary.duplicates.length > 0) {
    console.log("Skipped possible duplicates:");
    for (const duplicateDescription of summary.duplicates) {
      console.log(`- ${duplicateDescription}`);
    }
  }
}

run().catch((error) => {
  console.error("Failed to import Palacios churches.", error);
  process.exitCode = 1;
});
