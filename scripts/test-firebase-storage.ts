import { config as loadEnv } from "dotenv";

import { getFirebaseAdminApp } from "@/lib/firebase/admin";
import {
  getFirebaseProjectId,
  getFirebaseStorageBucketName,
  shouldUseFirebaseEmulators,
} from "@/lib/firebase/config";
import {
  runFirebaseStorageUploadSmokeTest,
  verifyFirebaseStorageBucketConnection,
} from "@/lib/firebase/storage";

loadEnv({
  path: ".env.local",
});

interface JsonResponse<T = unknown> {
  status: number;
  data: T;
}

function summarizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function getAccessToken() {
  const app = getFirebaseAdminApp();

  if (!app?.options.credential || !("getAccessToken" in app.options.credential)) {
    return null;
  }

  const tokenResponse = await app.options.credential.getAccessToken();
  return tokenResponse.access_token;
}

async function getAuthenticatedJson(url: string): Promise<JsonResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      status: 0,
      data: {
        warning: "No Firebase Admin access token was available for REST diagnostics.",
      },
    };
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = (await response.json()) as unknown;

  return {
    status: response.status,
    data,
  };
}

async function run() {
  const projectId = getFirebaseProjectId();
  const configuredBucket = getFirebaseStorageBucketName();

  if (!projectId) {
    throw new Error("Missing Firebase project id configuration.");
  }

  const defaultBucketResponse = shouldUseFirebaseEmulators()
    ? {
        status: 0,
        data: {
          note: "Skipping live REST diagnostics while Firebase emulators are enabled.",
        },
      }
    : await getAuthenticatedJson(
        `https://firebasestorage.googleapis.com/v1alpha/projects/${projectId}/defaultBucket`,
      );
  const bucketListResponse = shouldUseFirebaseEmulators()
    ? {
        status: 0,
        data: {
          note: "Skipping live bucket listing while Firebase emulators are enabled.",
        },
      }
    : await getAuthenticatedJson(
        `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(projectId)}`,
      );

  console.log("Firebase Storage configuration");
  console.log(`- Project: ${projectId}`);
  console.log(`- Configured bucket: ${configuredBucket ?? "missing"}`);
  console.log(`- Emulators enabled: ${shouldUseFirebaseEmulators() ? "yes" : "no"}`);
  console.log("");
  console.log("Project diagnostics");
  console.log(`- Default bucket API status: ${defaultBucketResponse.status}`);
  console.log(JSON.stringify(defaultBucketResponse.data, null, 2));
  console.log(`- Bucket listing API status: ${bucketListResponse.status}`);
  console.log(JSON.stringify(bucketListResponse.data, null, 2));

  const connection = await verifyFirebaseStorageBucketConnection();
  const smokeTest = await runFirebaseStorageUploadSmokeTest();

  console.log("");
  console.log("Bucket verification");
  console.log(JSON.stringify(connection, null, 2));
  console.log("");
  console.log("Upload test");
  console.log(JSON.stringify(smokeTest, null, 2));
  console.log("");
  console.log("Firebase Storage upload test passed.");
}

run().catch((error) => {
  console.error("Firebase Storage upload test failed.");
  console.error(summarizeError(error));
  process.exitCode = 1;
});
