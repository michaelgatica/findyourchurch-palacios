"use client";

import { connectStorageEmulator, getStorage } from "firebase/storage";

import {
  getFirebaseClientApp,
  haveFirebaseClientEmulatorsConnected,
  markFirebaseClientEmulatorsConnected,
  shouldConnectFirebaseClientToEmulators,
} from "@/lib/firebase/client";

export function getFirebaseClientStorage() {
  const app = getFirebaseClientApp();

  if (!app) {
    return null;
  }

  const storage = getStorage(app);

  if (
    shouldConnectFirebaseClientToEmulators() &&
    !haveFirebaseClientEmulatorsConnected("storage")
  ) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    markFirebaseClientEmulatorsConnected("storage");
  }

  return storage;
}
