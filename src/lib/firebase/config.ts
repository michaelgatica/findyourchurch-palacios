const trueValues = new Set(["1", "true", "yes", "on"]);
const warnedMessages = new Set<string>();

export const firebasePublicEnvVarNames = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export const firebaseAdminEnvVarNames = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_SERVICE_ACCOUNT_KEY_PATH",
] as const;

export const firebaseStorageEnvVarNames = [
  "FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
] as const;

export const firebaseEmulatorEnvVarNames = [
  "NEXT_PUBLIC_USE_FIREBASE_EMULATORS",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
] as const;

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface FirebaseServerConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  storageBucket?: string;
  databaseId?: string;
  serviceAccountKeyPath?: string;
  adminNotificationEmail?: string;
}

function normalizeOptionalValue(value?: string) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function normalizeStorageBucketName(value?: string) {
  const normalizedValue = normalizeOptionalValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return normalizedValue.replace(/^gs:\/\//i, "").replace(/\/+$/, "");
}

function warnFirebaseConfigurationOnce(message: string) {
  if (warnedMessages.has(message)) {
    return;
  }

  warnedMessages.add(message);
  console.warn(message);
}

function handleConfigurationProblem(message: string) {
  if (isProductionEnvironment()) {
    throw new Error(message);
  }

  warnFirebaseConfigurationOnce(message);
}

function getFirebasePublicConfigCandidates() {
  return {
    apiKey: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: normalizeStorageBucketName(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: normalizeOptionalValue(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    measurementId: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
  };
}

export function getMissingFirebasePublicEnvVarNames() {
  const config = getFirebasePublicConfigCandidates();
  const missingEnvVarNames: string[] = [];

  if (!config.apiKey) {
    missingEnvVarNames.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  }

  if (!config.authDomain) {
    missingEnvVarNames.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  }

  if (!config.projectId) {
    missingEnvVarNames.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }

  if (!config.storageBucket) {
    missingEnvVarNames.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  }

  if (!config.messagingSenderId) {
    missingEnvVarNames.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  }

  if (!config.appId) {
    missingEnvVarNames.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  }

  return missingEnvVarNames;
}

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const config = getFirebasePublicConfigCandidates();
  const missingEnvVarNames = getMissingFirebasePublicEnvVarNames();

  if (missingEnvVarNames.length > 0) {
    handleConfigurationProblem(
      `Firebase client configuration is incomplete. Missing environment variables: ${missingEnvVarNames.join(
        ", ",
      )}.`,
    );
    return null;
  }

  return {
    apiKey: config.apiKey!,
    authDomain: config.authDomain!,
    projectId: config.projectId!,
    storageBucket: config.storageBucket!,
    messagingSenderId: config.messagingSenderId!,
    appId: config.appId!,
    measurementId: config.measurementId,
  };
}

export function isFirebaseClientConfigured() {
  return getMissingFirebasePublicEnvVarNames().length === 0;
}

export function getFirebaseServerConfig(): FirebaseServerConfig {
  return {
    projectId:
      normalizeOptionalValue(process.env.FIREBASE_PROJECT_ID) ??
      normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    clientEmail: normalizeOptionalValue(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: normalizeOptionalValue(process.env.FIREBASE_PRIVATE_KEY)?.replace(
      /\\n/g,
      "\n",
    ),
    storageBucket:
      normalizeStorageBucketName(process.env.FIREBASE_STORAGE_BUCKET) ??
      normalizeStorageBucketName(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    databaseId:
      normalizeOptionalValue(process.env.FIREBASE_DATABASE_ID) ??
      normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID),
    serviceAccountKeyPath: normalizeOptionalValue(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH),
    adminNotificationEmail: normalizeOptionalValue(process.env.ADMIN_NOTIFICATION_EMAIL),
  };
}

function hasFirebaseServerCredentials(config: FirebaseServerConfig) {
  if (shouldUseFirebaseEmulators()) {
    return Boolean(config.projectId);
  }

  return Boolean(
    config.projectId &&
      (config.serviceAccountKeyPath || (config.clientEmail && config.privateKey)),
  );
}

export function getMissingFirebaseServerEnvVarNames() {
  const config = getFirebaseServerConfig();
  const missingEnvVarNames: string[] = [];

  if (!config.projectId) {
    missingEnvVarNames.push("FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)");
  }

  if (!shouldUseFirebaseEmulators() && !config.serviceAccountKeyPath) {
    if (!config.clientEmail) {
      missingEnvVarNames.push("FIREBASE_CLIENT_EMAIL");
    }

    if (!config.privateKey) {
      missingEnvVarNames.push("FIREBASE_PRIVATE_KEY");
    }
  }

  return missingEnvVarNames;
}

export function assertFirebaseServerConfig() {
  const missingEnvVarNames = getMissingFirebaseServerEnvVarNames();

  if (missingEnvVarNames.length > 0) {
    handleConfigurationProblem(
      `Firebase Admin SDK configuration is incomplete. Missing environment variables: ${missingEnvVarNames.join(
        ", ",
      )}.`,
    );
    return false;
  }

  return true;
}

export function getFirebaseProjectId() {
  return getFirebaseServerConfig().projectId;
}

export function getFirebaseDatabaseId() {
  return getFirebaseServerConfig().databaseId;
}

export function getFirebaseStorageBucketName() {
  return getFirebaseServerConfig().storageBucket;
}

export function getMissingFirebaseStorageEnvVarNames() {
  const config = getFirebaseServerConfig();
  const missingEnvVarNames = getMissingFirebaseServerEnvVarNames();

  if (!config.storageBucket) {
    missingEnvVarNames.push(
      "FIREBASE_STORAGE_BUCKET (or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)",
    );
  }

  return missingEnvVarNames;
}

export function assertFirebaseStorageConfig() {
  const missingEnvVarNames = getMissingFirebaseStorageEnvVarNames();

  if (missingEnvVarNames.length > 0) {
    handleConfigurationProblem(
      `Firebase Storage configuration is incomplete. Missing environment variables: ${missingEnvVarNames.join(
        ", ",
      )}.`,
    );
    return false;
  }

  return true;
}

export function shouldUseFirebaseEmulators() {
  const explicitFlag = normalizeOptionalValue(process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS);

  if (explicitFlag) {
    return trueValues.has(explicitFlag.toLowerCase());
  }

  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  );
}

export function isFirebaseServerConfigured() {
  return hasFirebaseServerCredentials(getFirebaseServerConfig());
}

export function isFirebaseStorageConfigured() {
  const config = getFirebaseServerConfig();
  return hasFirebaseServerCredentials(config) && Boolean(config.storageBucket);
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function canUseLocalUploadFallback() {
  return !isProductionEnvironment();
}
