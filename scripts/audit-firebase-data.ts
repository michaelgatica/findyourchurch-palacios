import { config as loadEnv } from "dotenv";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";

loadEnv({
  path: ".env.local",
});

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function looksLikeDemoChurch(data: Record<string, unknown>) {
  const slug = asString(data.slug).toLowerCase();
  const name = asString(data.name).toLowerCase();

  return (
    data.isSeedContent === true ||
    slug.includes("st-mark-by-the-bay") ||
    slug.includes("grace-harbor-fellowship") ||
    slug.includes("iglesia-esperanza-palacios") ||
    slug.includes("river-of-life-chapel") ||
    name.includes("demo") ||
    name.includes("sample")
  );
}

function looksLikeTestChurch(data: Record<string, unknown>) {
  const slug = asString(data.slug).toLowerCase();
  const name = asString(data.name).toLowerCase();

  return (
    slug.includes("test") ||
    slug.startsWith("phase-") ||
    slug.includes("workflow") ||
    name.includes("test") ||
    name.includes("workflow") ||
    name.includes("repository")
  );
}

function looksLikeTestEmail(value: unknown) {
  const email = asString(value).toLowerCase();
  return email.includes("@example.") || email.includes("+test") || email.includes("test@");
}

async function countCollection(collectionName: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const snapshot = await firestore.collection(collectionName).get();
  return snapshot.docs;
}

async function run() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const [
    churches,
    submissions,
    representatives,
    claims,
    updates,
    ownershipTransfers,
    users,
    messages,
    auditLogs,
    emailLogs,
  ] = await Promise.all([
    countCollection(firestoreCollectionNames.churches),
    countCollection(firestoreCollectionNames.churchSubmissions),
    countCollection(firestoreCollectionNames.churchRepresentatives),
    countCollection(firestoreCollectionNames.churchClaimRequests),
    countCollection(firestoreCollectionNames.churchUpdateRequests),
    countCollection(firestoreCollectionNames.ownershipTransferRequests),
    countCollection(firestoreCollectionNames.users),
    countCollection(firestoreCollectionNames.messages),
    countCollection(firestoreCollectionNames.auditLogs),
    countCollection(firestoreCollectionNames.emailLogs),
  ]);

  const churchData = churches.map((documentSnapshot) => asRecord(documentSnapshot.data()));
  const representativeData = representatives.map((documentSnapshot) =>
    asRecord(documentSnapshot.data()),
  );
  const userData = users.map((documentSnapshot) => asRecord(documentSnapshot.data()));

  const churchesByStatus = churchData.reduce<Record<string, number>>((counts, church) => {
    const status = asString(church.status) || "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  const representativesByStatus = representativeData.reduce<Record<string, number>>(
    (counts, representative) => {
      const status = asString(representative.status) || "unknown";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {},
  );

  const audit = {
    generatedAt: new Date().toISOString(),
    collections: {
      churches: churches.length,
      churchSubmissions: submissions.length,
      churchRepresentatives: representatives.length,
      churchClaimRequests: claims.length,
      churchUpdateRequests: updates.length,
      ownershipTransferRequests: ownershipTransfers.length,
      users: users.length,
      messages: messages.length,
      auditLogs: auditLogs.length,
      emailLogs: emailLogs.length,
    },
    churches: {
      byStatus: churchesByStatus,
      published: churchesByStatus.published ?? 0,
      pendingReview: churchesByStatus.pending_review ?? 0,
      archived: churchesByStatus.archived ?? 0,
      claimed: churchData.filter((church) => Boolean(church.primaryRepresentativeId)).length,
      unclaimed: churchData.filter((church) => !church.primaryRepresentativeId).length,
      demoLooking: churchData.filter(looksLikeDemoChurch).length,
      testLooking: churchData.filter(looksLikeTestChurch).length,
      missingMailingAddress: churchData.filter((church) => !church.mailingAddress).length,
    },
    representatives: {
      byStatus: representativesByStatus,
      active: representativesByStatus.active ?? 0,
      suspended: representativesByStatus.suspended ?? 0,
      transferred: representativesByStatus.transferred ?? 0,
    },
    users: {
      adminUsers: userData.filter((user) => user.role === "admin").length,
      testLookingEmails: userData.filter((user) => looksLikeTestEmail(user.email)).length,
    },
    notes: [
      "This audit is read-only.",
      "Review demoLooking and testLooking counts before launch.",
      "missingMailingAddress is informational only; many churches use the same physical and mailing address.",
    ],
  };

  console.log(JSON.stringify(audit, null, 2));
}

run().catch((error) => {
  console.error("Failed to audit Firebase data.", error);
  process.exitCode = 1;
});
