import { readFileSync } from "fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT ?? "demo-find-your-church";

export async function runFirestoreRuleTests() {
  const testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });

  try {
    await seedFirestore(testEnvironment);

    const anonymous = testEnvironment.unauthenticatedContext().firestore();
    const representativeA = testEnvironment
      .authenticatedContext("representative-a", { email: "rep-a@example.test" })
      .firestore();
    const representativeB = testEnvironment
      .authenticatedContext("representative-b", { email: "rep-b@example.test" })
      .firestore();
    const admin = testEnvironment
      .authenticatedContext("platform-admin", { email: "admin@example.test" })
      .firestore();

    await assertSucceeds(getDoc(doc(anonymous, "publicEvents/published-event")));
    await assertFails(getDoc(doc(anonymous, "publicEvents/draft-event")));
    await assertSucceeds(getDoc(doc(anonymous, "publicEvents/unlisted-event")));
    await assertSucceeds(getDoc(doc(anonymous, "publicEvents/cancelled-published-event")));
    await assertFails(getDoc(doc(anonymous, "publicEvents/cancelled-unpublished-event")));

    await assertSucceeds(
      getDocs(
        query(
          collection(anonymous, "publicEvents"),
          where("status", "==", "published"),
          where("visibility", "==", "public"),
          where("wasPublished", "==", true),
        ),
      ),
    );
    await assertFails(
      getDocs(query(collection(anonymous, "publicEvents"), where("status", "==", "unlisted"))),
    );

    for (const privateCollection of [
      "events",
      "eventRegistrations",
      "eventRegistrationConfigurations",
      "eventFormVersions",
      "eventRegistrationCounters",
      "eventRegistrationTokens",
      "eventRegistrationConfirmations",
      "eventRegistrationIdempotency",
      "eventRegistrationRateLimits",
      "eventExports",
      "eventScheduledJobs",
    ]) {
      await assertFails(getDoc(doc(anonymous, `${privateCollection}/private-record`)));
      await assertFails(getDocs(collection(anonymous, privateCollection)));
      await assertFails(getDoc(doc(representativeA, `${privateCollection}/private-record`)));
      await assertFails(getDoc(doc(representativeB, `${privateCollection}/private-record`)));
      await assertSucceeds(getDoc(doc(admin, `${privateCollection}/private-record`)));
    }

    await assertFails(
      setDoc(doc(representativeA, "eventRegistrations/forged-registration"), {
        churchId: "church-a",
        eventId: "published-event",
        status: "confirmed",
      }),
    );
    await assertFails(
      setDoc(doc(representativeA, "eventRegistrationCounters/published-event"), {
        confirmed: 999,
      }),
    );
    await assertFails(
      setDoc(doc(admin, "eventRegistrationCounters/published-event"), {
        confirmed: 999,
      }),
    );
    await assertFails(
      setDoc(doc(admin, "eventRegistrations/forged-registration"), {
        churchId: "church-a",
        eventId: "published-event",
        status: "confirmed",
      }),
    );
    await assertFails(
      setDoc(doc(admin, "publicEvents/forged-projection"), {
        status: "published",
        visibility: "public",
        wasPublished: true,
      }),
    );
    await assertFails(
      setDoc(doc(representativeA, "eventFormVersions/forged-version"), {
        churchId: "church-b",
        version: 1,
      }),
    );
    await assertFails(
      setDoc(doc(representativeA, "auditLogs/forged-audit"), {
        action: "registration_approved",
      }),
    );
    await assertFails(
      setDoc(doc(representativeA, "users/representative-a"), {
        role: "admin",
      }),
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          suite: "firestore-rules",
          checks: [
            "published public event can be read",
            "draft public projection is denied",
            "unlisted direct read works but enumeration is denied",
            "only previously published cancelled events can be read",
            "registration, form, token, export, job, and counter records are private",
            "representatives cannot forge protected records or roles",
            "platform admin can read protected records but cannot forge server-maintained event data",
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

async function seedFirestore(testEnvironment: RulesTestEnvironment) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const now = new Date().toISOString();
    const publicBase = {
      churchId: "church-a",
      churchName: "Test Church A",
      slug: "test-event",
      title: "Test Event",
      startsAt: now,
      visibility: "public",
      wasPublished: true,
      publishedAt: now,
    };

    await Promise.all([
      setDoc(doc(firestore, "users/platform-admin"), { role: "admin" }),
      setDoc(doc(firestore, "users/representative-a"), { role: "church_primary" }),
      setDoc(doc(firestore, "users/representative-b"), { role: "church_primary" }),
      setDoc(doc(firestore, "publicEvents/published-event"), {
        ...publicBase,
        status: "published",
      }),
      setDoc(doc(firestore, "publicEvents/draft-event"), {
        ...publicBase,
        status: "draft",
        wasPublished: false,
      }),
      setDoc(doc(firestore, "publicEvents/unlisted-event"), {
        ...publicBase,
        status: "unlisted",
        visibility: "unlisted",
      }),
      setDoc(doc(firestore, "publicEvents/cancelled-published-event"), {
        ...publicBase,
        status: "cancelled",
      }),
      setDoc(doc(firestore, "publicEvents/cancelled-unpublished-event"), {
        ...publicBase,
        status: "cancelled",
        wasPublished: false,
        publishedAt: null,
      }),
    ]);

    for (const privateCollection of [
      "events",
      "eventRegistrations",
      "eventRegistrationConfigurations",
      "eventFormVersions",
      "eventRegistrationCounters",
      "eventRegistrationTokens",
      "eventRegistrationConfirmations",
      "eventRegistrationIdempotency",
      "eventRegistrationRateLimits",
      "eventExports",
      "eventScheduledJobs",
    ]) {
      await setDoc(doc(firestore, `${privateCollection}/private-record`), {
        churchId: "church-a",
        eventId: "published-event",
        createdAt: now,
      });
    }
  });
}

if (process.argv[1]?.includes("test-firestore-rules")) {
  runFirestoreRuleTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
