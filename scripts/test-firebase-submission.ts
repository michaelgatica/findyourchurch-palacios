import { readFileSync } from "fs";
import path from "path";

import { config as loadEnv } from "dotenv";

import { createChurchSubmission } from "@/lib/repositories/submission-repository";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

loadEnv({
  path: ".env.local",
});

function createValidatedImageUpload(
  kind: "logo" | "photo",
  originalName: string,
): ValidatedUploadFile {
  const assetPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "logos",
    "find-your-church-palacios-512.png",
  );
  const buffer = readFileSync(assetPath);

  return {
    kind,
    originalName,
    extension: ".png",
    mimeType: "image/png",
    size: buffer.byteLength,
    width: 512,
    height: 512,
    buffer,
  };
}

async function createSubmissionCase(
  label: string,
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  },
) {
  const timestampSuffix = `${Date.now()}-${label}`;
  const submission = await createChurchSubmission(
    {
      churchName: `Repository Test Church ${timestampSuffix}`,
      addressLine1: "700 Verification Drive",
      city: "Palacios",
      stateCode: "TX",
      postalCode: "77465",
      phone: "(361) 555-0166",
      email: `verification-${timestampSuffix}@example.org`,
      denomination: "Independent",
      shortDescription:
        "Repository-level verification submission to confirm pending review storage in Firebase.",
      serviceTimes: ["Sunday Worship - 9:30 AM"],
      primaryContactName: "Verification Contact",
      primaryContactEmail: `contact-${timestampSuffix}@example.org`,
      primaryContactRole: "Administrator",
      primaryContactPhone: "(361) 555-0199",
      communicationConsent: true,
      termsAccepted: true,
      followUpEmailOptIn: false,
      languages: ["English"],
      additionalLeaders: [],
      ministryTags: ["Verification"],
      childrenMinistryAvailable: false,
      youthMinistryAvailable: false,
      nurseryCareAvailable: false,
      spanishServiceAvailable: false,
      livestreamAvailable: false,
      wheelchairAccessible: true,
    },
    uploads,
  );

  return {
    case: label,
    id: submission.id,
    slug: submission.slug,
    status: submission.status,
    uploadBackends: submission.uploads.map((upload) => upload.backend),
    uploadPaths: submission.uploads.map((upload) => upload.storagePath ?? upload.relativePath),
  };
}

async function run() {
  const results = [];

  results.push(
    await createSubmissionCase("no_images", {
      churchPhotos: [],
    }),
  );
  results.push(
    await createSubmissionCase("logo_only", {
      churchLogo: createValidatedImageUpload(
        "logo",
        "find-your-church-palacios-512.png",
      ),
      churchPhotos: [],
    }),
  );
  results.push(
    await createSubmissionCase("photos_only", {
      churchPhotos: [
        createValidatedImageUpload("photo", "church-photo-1.png"),
        createValidatedImageUpload("photo", "church-photo-2.png"),
      ],
    }),
  );

  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error("Failed Firebase submission verification.", error);
  process.exitCode = 1;
});
