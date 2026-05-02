import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

import {
  getFirebaseDatabaseId,
  getFirebasePublicConfig,
  shouldUseFirebaseEmulators,
} from "@/lib/firebase/config";

type FirebaseClientEmulatorService = "auth" | "storage";

const initializedEmulatorServices = new Set<FirebaseClientEmulatorService>();

export function getFirebaseClientApp(): FirebaseApp | null {
  const config = getFirebasePublicConfig();

  if (!config) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
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
