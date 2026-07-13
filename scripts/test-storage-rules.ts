import { readFileSync } from "fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

const projectId = process.env.GCLOUD_PROJECT ?? "demo-find-your-church";
const bucketName = `${projectId}.appspot.com`;

async function seedStorageObject(path: string, contentType: string, body: string) {
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
  const response = await fetch(
    `http://${emulatorHost}/v0/b/${bucketName}/o?name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": contentType,
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to seed Storage emulator object: ${response.status} ${await response.text()}`);
  }
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
    const privateExportPath = "private/event-exports/church-a/event-a/report.xlsx";
    await seedStorageObject(flyerPath, "image/jpeg", "test-image");
    await seedStorageObject(privateExportPath, "application/octet-stream", "private-report");

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
    await assertFails(representativeAStorage.ref(privateExportPath).getDownloadURL());
    await assertFails(representativeBStorage.ref(privateExportPath).getDownloadURL());

    const imageBytes = new TextEncoder().encode("browser-image");
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

    console.log(
      JSON.stringify(
        {
          ok: true,
          suite: "storage-rules",
          checks: [
            "public flyer object can be read",
            "public flyer directories cannot be listed",
            "private exports cannot be read by public or representatives",
            "all direct flyer and export writes are denied",
            "cross-church writes are denied",
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
