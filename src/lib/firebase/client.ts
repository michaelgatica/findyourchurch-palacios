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

function initializeFirebaseAppCheck(app: FirebaseApp) {
  if (typeof window === "undefined" || appCheckInitialized) {
    return;
  }

  const siteKey = process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY?.trim();
  if (!siteKey) {
    return;
  }

  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInitialized = true;
  void getToken(appCheck).catch(() => {
    console.warn("Firebase App Check token initialization failed; details were omitted.");
  });
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
