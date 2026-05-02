import { existsSync, readFileSync } from "fs";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore as getFirestoreService } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import {
  assertFirebaseServerConfig,
  assertFirebaseStorageConfig,
  getFirebaseDatabaseId,
  getFirebaseProjectId,
  getFirebaseServerConfig,
  getFirebaseStorageBucketName,
  isGoogleManagedFirebaseRuntime,
  isProductionEnvironment,
  shouldUseFirebaseEmulators,
} from "@/lib/firebase/config";

interface ServiceAccountFromFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

const firebaseAdminAppName = "find-your-church-admin";

function loadServiceAccountFromFile(serviceAccountKeyPath: string) {
  if (!existsSync(serviceAccountKeyPath)) {
    const message = `Firebase service account file was not found at "${serviceAccountKeyPath}".`;

    if (isProductionEnvironment()) {
      throw new Error(message);
    }

    console.warn(message);
    return null;
  }

  try {
    const parsed = JSON.parse(
      readFileSync(serviceAccountKeyPath, "utf8"),
    ) as ServiceAccountFromFile;

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch (error) {
    if (isProductionEnvironment()) {
      throw new Error("Unable to read the configured Firebase service account file.");
    }

    console.error("Unable to read Firebase service account file", error);
    return null;
  }
}

function resolveServiceAccount() {
  const serverConfig = getFirebaseServerConfig();

  if (serverConfig.serviceAccountKeyPath) {
    const serviceAccountFromFile = loadServiceAccountFromFile(
      serverConfig.serviceAccountKeyPath,
    );

    if (serviceAccountFromFile) {
      return serviceAccountFromFile;
    }
  }

  if (serverConfig.projectId && serverConfig.clientEmail && serverConfig.privateKey) {
    return {
      projectId: serverConfig.projectId,
      clientEmail: serverConfig.clientEmail,
      privateKey: serverConfig.privateKey,
    };
  }

  return null;
}

export function getFirebaseAdminApp(): App | null {
  const existingApp = getApps().find((app) => app.name === firebaseAdminAppName);

  if (existingApp) {
    return existingApp;
  }

  if (!assertFirebaseServerConfig()) {
    return null;
  }

  const projectId = getFirebaseProjectId();
  const storageBucket = getFirebaseStorageBucketName();
  const emulatorMode = shouldUseFirebaseEmulators();
  const serviceAccount = resolveServiceAccount();
  const appOptions: AppOptions = {};

  if (projectId) {
    appOptions.projectId = projectId;
  }

  if (storageBucket) {
    appOptions.storageBucket = storageBucket;
  }

  if (serviceAccount) {
    appOptions.credential = cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    });
  } else if (!emulatorMode && isGoogleManagedFirebaseRuntime()) {
    appOptions.credential = applicationDefault();
  } else if (emulatorMode) {
    // The local Firebase Emulator Suite can run without live service account credentials.
  } else if (isProductionEnvironment()) {
    throw new Error("Firebase Admin SDK credentials are not available in production.");
  } else {
    return null;
  }

  return initializeApp(appOptions, firebaseAdminAppName);
}

export function isFirebaseAdminAvailable() {
  return getFirebaseAdminApp() !== null;
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseAdminFirestore() {
  const app = getFirebaseAdminApp();

  if (!app) {
    return null;
  }

  const databaseId = getFirebaseDatabaseId();
  return databaseId ? getFirestoreService(app, databaseId) : getFirestoreService(app);
}

export function getFirebaseAdminBucket() {
  const app = getFirebaseAdminApp();
  const bucketName = getFirebaseStorageBucketName();

  if (!app || !bucketName || !assertFirebaseStorageConfig()) {
    return null;
  }

  return getStorage(app).bucket(bucketName);
}
