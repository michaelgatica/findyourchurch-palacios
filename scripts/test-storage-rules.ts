import { readFileSync } from "fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const projectId = process.env.GCLOUD_PROJECT ?? "demo-find-your-church";
const bucketName = `${projectId}.appspot.com`;

async function seedStorageObject(
  testEnvironment: RulesTestEnvironment,
  path: string,
  contentType: string,
  body: string,
) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await context
      .storage(`gs://${bucketName}`)
      .ref(path)
      .put(new TextEncoder().encode(body), { contentType });
  });
}

export async function runStorageRuleTests() {
  const testEnvironment = await initializeTestEnvironment({
    projectId,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
    },
  });

  try {
    const flyerPath = "churches/church-a/events/event-a/flyer/flyer.jpg";
    const misroutedExportPath = "churches/church-a/events/event-a/flyer/private-report.xlsx";
    const privateExportPath = "private/event-exports/church-a/event-a/report.xlsx";
    await seedStorageObject(testEnvironment, flyerPath, "image/jpeg", "test-image");
    await seedStorageObject(
      testEnvironment,
      misroutedExportPath,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "misrouted-private-report",
    );
    await seedStorageObject(
      testEnvironment,
      privateExportPath,
      "application/octet-stream",
      "private-report",
    );

    const anonymousStorage = testEnvironment
      .unauthenticatedContext()
      .storage(`gs://${bucketName}`);
    const representativeAStorage = testEnvironment
      .authenticatedContext("representative-a")
      .storage(`gs://${bucketName}`);
    const representativeBStorage = testEnvironment
      .authenticatedContext("representative-b")
      .storage(`gs://${bucketName}`);

    await assertSucceeds(anonymousStorage.ref(flyerPath).getDownloadURL());
    await assertFails(
      anonymousStorage.ref("churches/church-a/events/event-a/flyer").listAll(),
    );
    await assertFails(anonymousStorage.ref(privateExportPath).getDownloadURL());
    await assertFails(anonymousStorage.ref(misroutedExportPath).getDownloadURL());
    await assertFails(representativeAStorage.ref(privateExportPath).getDownloadURL());
    await assertFails(representativeBStorage.ref(privateExportPath).getDownloadURL());

    const imageBytes = new TextEncoder().encode("browser-image");
    await assertFails(
      Promise.resolve(
        anonymousStorage.ref(flyerPath).put(imageBytes, { contentType: "image/jpeg" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        representativeAStorage.ref(flyerPath).put(imageBytes, { contentType: "image/jpeg" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        representativeAStorage
          .ref("churches/church-b/events/event-b/flyer/forged.jpg")
          .put(imageBytes, { contentType: "image/jpeg" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        representativeAStorage.ref(privateExportPath).put(imageBytes, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ),
    );
    await assertFails(representativeAStorage.ref(flyerPath).delete());

    console.log(
      JSON.stringify(
        {
          ok: true,
          suite: "storage-rules",
          checks: [
            "public flyer object can be read",
            "public flyer directories cannot be listed",
            "private exports cannot be read by public or representatives",
            "export content cannot be exposed from a public flyer path",
            "anonymous flyer uploads are denied",
            "all direct flyer and export writes are denied",
            "cross-church writes are denied",
            "unauthorized flyer deletion is denied",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await testEnvironment.cleanup();
  }
}

if (process.argv[1]?.includes("test-storage-rules")) {
  runStorageRuleTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
