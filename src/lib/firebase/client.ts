import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

import {
  getFirebaseDatabaseId,
  getFirebasePublicConfig,
  shouldUseFirebaseEmulators,
} from "@/lib/firebase/config";

type FirebaseClientEmulatorService = "auth" | "storage";

const initializedEmulatorServices = new Set<FirebaseClientEmulatorService>();
let appCheckInitialized = false;
let appCheckTokenReadyPromise: Promise<void> | null = null;

function initializeFirebaseAppCheck(app: FirebaseApp) {
  if (typeof window === "undefined") {
    return null;
  }

  const siteKey = process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY?.trim();
  if (!siteKey) {
    return null;
  }

  if (!appCheckInitialized) {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
    appCheckTokenReadyPromise = getToken(appCheck).then(() => undefined);
    void appCheckTokenReadyPromise.catch(() => {
      console.warn("Firebase App Check token initialization failed; details were omitted.");
    });
  }

  return appCheckTokenReadyPromise;
}

export function getFirebaseClientApp(): FirebaseApp | null {
  const config = getFirebasePublicConfig();

  if (!config) {
    return null;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  initializeFirebaseAppCheck(app);
  return app;
}

export async function waitForFirebaseAppCheckToken() {
  const app = getFirebaseClientApp();

  if (!app) {
    return;
  }

  const tokenReadyPromise = initializeFirebaseAppCheck(app);

  if (!tokenReadyPromise) {
    return;
  }

  try {
    await tokenReadyPromise;
  } catch {
    throw new Error(
      "Security verification could not be completed. Please refresh the page and try again.",
    );
  }
}

export function getFirebaseClientDatabaseId() {
  return getFirebaseDatabaseId();
}

export function shouldConnectFirebaseClientToEmulators() {
  return shouldUseFirebaseEmulators() && typeof window !== "undefined";
}

export function markFirebaseClientEmulatorsConnected(
  service: FirebaseClientEmulatorService,
) {
  initializedEmulatorServices.add(service);
}

export function haveFirebaseClientEmulatorsConnected(
  service: FirebaseClientEmulatorService,
) {
  return initializedEmulatorServices.has(service);
}
