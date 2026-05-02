const trueValues = new Set(["1", "true", "yes", "on"]);

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

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const config = {
    apiKey: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: normalizeOptionalValue(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    measurementId: normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
  };

  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.storageBucket ||
    !config.messagingSenderId ||
    !config.appId
  ) {
    return null;
  }

  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId,
  };
}

export function isFirebaseClientConfigured() {
  return getFirebasePublicConfig() !== null;
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
      normalizeOptionalValue(process.env.FIREBASE_STORAGE_BUCKET) ??
      normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    databaseId:
      normalizeOptionalValue(process.env.FIREBASE_DATABASE_ID) ??
      normalizeOptionalValue(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID),
    serviceAccountKeyPath: normalizeOptionalValue(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH),
    adminNotificationEmail: normalizeOptionalValue(process.env.ADMIN_NOTIFICATION_EMAIL),
  };
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
  const serverConfig = getFirebaseServerConfig();

  if (shouldUseFirebaseEmulators()) {
    return Boolean(serverConfig.projectId);
  }

  return Boolean(
    serverConfig.projectId &&
      serverConfig.storageBucket &&
      (serverConfig.serviceAccountKeyPath ||
        (serverConfig.clientEmail && serverConfig.privateKey)),
  );
}
