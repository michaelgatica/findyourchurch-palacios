import { readFileSync } from "fs";
import path from "path";

import { config as loadEnv } from "dotenv";

import { createChurchSubmission } from "@/lib/repositories/submission-repository";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

loadEnv({
  path: ".env.local",
});

function createValidatedImageUpload(): ValidatedUploadFile {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "logos",
    "find-your-church-palacios-512.png",
  );

  return {
    kind: "logo",
    originalName: "find-your-church-palacios-512.png",
    extension: ".png",
    mimeType: "image/png",
    size: readFileSync(logoPath).byteLength,
    width: 512,
    height: 512,
    buffer: readFileSync(logoPath),
  };
}

async function run() {
  const timestampSuffix = Date.now();
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
    {
      churchLogo: createValidatedImageUpload(),
      churchPhotos: [],
    },
  );

  console.log(
    JSON.stringify(
      {
        id: submission.id,
        slug: submission.slug,
        status: submission.status,
        uploadBackends: submission.uploads.map((upload) => upload.backend),
        uploadPaths: submission.uploads.map((upload) => upload.storagePath ?? upload.relativePath),
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("Failed Firebase submission verification.", error);
  process.exitCode = 1;
});
