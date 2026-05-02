"use client";

import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import {
  getFirebaseClientApp,
  haveFirebaseClientEmulatorsConnected,
  markFirebaseClientEmulatorsConnected,
  shouldConnectFirebaseClientToEmulators,
} from "@/lib/firebase/client";

let persistenceConfigured = false;

export function getFirebaseClientAuth() {
  const app = getFirebaseClientApp();

  if (!app) {
    return null;
  }

  const auth = getAuth(app);

  if (!persistenceConfigured) {
    persistenceConfigured = true;
    void setPersistence(auth, browserLocalPersistence);
  }

  if (
    shouldConnectFirebaseClientToEmulators() &&
    !haveFirebaseClientEmulatorsConnected("auth")
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    markFirebaseClientEmulatorsConnected("auth");
  }

  return auth;
}

export async function signInWithFirebaseEmail(email: string, password: string) {
  const auth = getFirebaseClientAuth();

  if (!auth) {
    throw new Error("Firebase Authentication is not configured.");
  }

  return signInWithEmailAndPassword(auth, email, password);
}

export async function createFirebaseUserAccount(email: string, password: string) {
  const auth = getFirebaseClientAuth();

  if (!auth) {
    throw new Error("Firebase Authentication is not configured.");
  }

  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutFirebaseUser() {
  const auth = getFirebaseClientAuth();

  if (!auth) {
    return;
  }

  await signOut(auth);
}

export function subscribeToFirebaseAuthState(
  callback: (user: User | null) => void,
) {
  const auth = getFirebaseClientAuth();

  if (!auth) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, callback);
}

export async function getCurrentFirebaseUser() {
  const auth = getFirebaseClientAuth();

  if (!auth) {
    return null;
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
