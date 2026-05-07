import { config as loadEnv } from "dotenv";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";

loadEnv({
  path: ".env.local",
});

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function run() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run");
  const preserveEmailArgument = process.argv.find((value) => value.startsWith("--preserve-email="));
  const preservedAdminEmail = preserveEmailArgument?.split("=")[1]?.trim().toLowerCase() ?? null;

  if (!confirm && !dryRun) {
    throw new Error(
      "Refusing to reset launch access without --confirm or --dry-run. This removes all non-admin Firebase Auth users, clears claim/update/ownership workflow records, deletes representative records, deletes related messages/audit/email logs, and resets churches to an unclaimed state.",
    );
  }

  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  if (!auth || !firestore) {
    throw new Error("Firebase Admin SDK is not configured.");
  }

  const [
    usersSnapshot,
    churchesSnapshot,
    representativesSnapshot,
    claimRequestsSnapshot,
    updateRequestsSnapshot,
    ownershipTransferRequestsSnapshot,
    messagesSnapshot,
    auditLogsSnapshot,
    emailLogsSnapshot,
  ] = await Promise.all([
    firestore.collection(firestoreCollectionNames.users).get(),
    firestore.collection(firestoreCollectionNames.churches).get(),
    firestore.collection(firestoreCollectionNames.churchRepresentatives).get(),
    firestore.collection(firestoreCollectionNames.churchClaimRequests).get(),
    firestore.collection(firestoreCollectionNames.churchUpdateRequests).get(),
    firestore.collection(firestoreCollectionNames.ownershipTransferRequests).get(),
    firestore.collection(firestoreCollectionNames.messages).get(),
    firestore.collection(firestoreCollectionNames.auditLogs).get(),
    firestore.collection(firestoreCollectionNames.emailLogs).get(),
  ]);

  const firestoreUsers: Array<Record<string, unknown> & { id: string; ref: typeof usersSnapshot.docs[number]["ref"] }> = usersSnapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ref: documentSnapshot.ref,
    ...asRecord(documentSnapshot.data()),
  }));

  const adminUsersToPreserve = firestoreUsers.filter((user) => {
    if (String(user.role ?? "") !== "admin") {
      return false;
    }

    if (!preservedAdminEmail) {
      return true;
    }

    return String(user.email ?? "").trim().toLowerCase() === preservedAdminEmail;
  });
  const adminUserIds = new Set(adminUsersToPreserve.map((user) => user.id));

  if (adminUserIds.size === 0) {
    throw new Error(
      preservedAdminEmail
        ? `No Firestore admin user matched --preserve-email=${preservedAdminEmail}. Aborting reset to avoid deleting every account.`
        : "No Firestore admin users were found. Aborting reset to avoid deleting every account.",
    );
  }

  const authUsers: Array<{ uid: string; email?: string | null }> = [];
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    authUsers.push(...result.users.map((user) => ({ uid: user.uid, email: user.email })));
    pageToken = result.pageToken;
  } while (pageToken);

  const authUserIdsToDelete = authUsers
    .filter((user) => !adminUserIds.has(user.uid))
    .map((user) => user.uid);
  const authEmailsToDelete = authUsers
    .filter((user) => !adminUserIds.has(user.uid))
    .map((user) => user.email)
    .filter((value): value is string => Boolean(value));

  const userDocsToDelete = usersSnapshot.docs.filter(
    (documentSnapshot) => !adminUserIds.has(documentSnapshot.id),
  );
  const deletedUserIds = new Set(userDocsToDelete.map((documentSnapshot) => documentSnapshot.id));

  const representativeDocsToDelete = representativesSnapshot.docs;
  const representativeIds = new Set(
    representativeDocsToDelete.map((documentSnapshot) => documentSnapshot.id),
  );

  const claimRequestDocsToDelete = claimRequestsSnapshot.docs;
  const claimRequestIds = new Set(
    claimRequestDocsToDelete.map((documentSnapshot) => documentSnapshot.id),
  );

  const updateRequestDocsToDelete = updateRequestsSnapshot.docs;
  const updateRequestIds = new Set(
    updateRequestDocsToDelete.map((documentSnapshot) => documentSnapshot.id),
  );

  const ownershipTransferDocsToDelete = ownershipTransferRequestsSnapshot.docs;
  const ownershipTransferIds = new Set(
    ownershipTransferDocsToDelete.map((documentSnapshot) => documentSnapshot.id),
  );

  const messageDocsToDelete = messagesSnapshot.docs.filter((documentSnapshot) => {
    const data = asRecord(documentSnapshot.data());

    return (
      claimRequestIds.has(String(data.claimRequestId ?? "")) ||
      updateRequestIds.has(String(data.updateRequestId ?? "")) ||
      representativeIds.has(String(data.senderId ?? "")) ||
      deletedUserIds.has(String(data.senderId ?? "")) ||
      String(data.senderType ?? "") === "representative"
    );
  });

  const auditLogDocsToDelete = auditLogsSnapshot.docs.filter((documentSnapshot) => {
    const data = asRecord(documentSnapshot.data());
    const entityType = String(data.entityType ?? "");
    const entityId = String(data.entityId ?? "");
    const actorId = String(data.actorId ?? "");

    return (
      entityType === "churchClaimRequest" ||
      entityType === "churchRepresentative" ||
      entityType === "churchUpdateRequest" ||
      entityType === "ownershipTransferRequest" ||
      claimRequestIds.has(entityId) ||
      representativeIds.has(entityId) ||
      updateRequestIds.has(entityId) ||
      ownershipTransferIds.has(entityId) ||
      deletedUserIds.has(actorId)
    );
  });

  const deletedEmailSet = new Set(authEmailsToDelete);

  const emailLogDocsToDelete = emailLogsSnapshot.docs.filter((documentSnapshot) => {
    const data = asRecord(documentSnapshot.data());
    const relatedEntityType = String(data.relatedEntityType ?? "");
    const relatedEntityId = String(data.relatedEntityId ?? "");
    const emailTo = String(data.to ?? "");

    return (
      relatedEntityType === "churchClaimRequest" ||
      relatedEntityType === "churchUpdateRequest" ||
      relatedEntityType === "ownershipTransferRequest" ||
      claimRequestIds.has(relatedEntityId) ||
      updateRequestIds.has(relatedEntityId) ||
      ownershipTransferIds.has(relatedEntityId) ||
      deletedEmailSet.has(emailTo)
    );
  });

  const churchesToReset = churchesSnapshot.docs.filter((documentSnapshot) => {
    const data = asRecord(documentSnapshot.data());

    return (
      data.primaryRepresentativeId !== null && data.primaryRepresentativeId !== undefined ||
      data.autoPublishUpdates === true ||
      data.lastRepresentativeActivityAt !== null && data.lastRepresentativeActivityAt !== undefined
    );
  });

  const preview = {
    adminUsersPreserved: firestoreUsers
      .filter((user) => adminUserIds.has(user.id))
      .map((user) => ({
        uid: user.id,
        email: String(user.email ?? ""),
        role: String(user.role ?? ""),
      })),
    authUsersToDelete: authUserIdsToDelete.length,
    firestoreUsersToDelete: userDocsToDelete.length,
    representativesToDelete: representativeDocsToDelete.length,
    claimRequestsToDelete: claimRequestDocsToDelete.length,
    updateRequestsToDelete: updateRequestDocsToDelete.length,
    ownershipTransfersToDelete: ownershipTransferDocsToDelete.length,
    messagesToDelete: messageDocsToDelete.length,
    auditLogsToDelete: auditLogDocsToDelete.length,
    emailLogsToDelete: emailLogDocsToDelete.length,
    churchesToReset: churchesToReset.length,
    affectedChurches: churchesToReset.map((documentSnapshot) => {
      const data = asRecord(documentSnapshot.data());

      return {
        id: documentSnapshot.id,
        name: String(data.name ?? ""),
        primaryRepresentativeId: data.primaryRepresentativeId ?? null,
      };
    }),
  };

  console.log("Launch reset preview:");
  console.log(JSON.stringify(preview, null, 2));

  if (dryRun) {
    console.log("Dry run complete. No records were changed.");
    return;
  }

  if (authUserIdsToDelete.length > 0) {
    for (const authUserIdChunk of chunk(authUserIdsToDelete, 1000)) {
      await auth.deleteUsers(authUserIdChunk);
    }
  }

  const allDocsToDelete = [
    ...messageDocsToDelete,
    ...emailLogDocsToDelete,
    ...auditLogDocsToDelete,
    ...ownershipTransferDocsToDelete,
    ...updateRequestDocsToDelete,
    ...claimRequestDocsToDelete,
    ...representativeDocsToDelete,
    ...userDocsToDelete,
  ];

  for (const documentChunk of chunk(allDocsToDelete, 400)) {
    const batch = firestore.batch();

    for (const documentSnapshot of documentChunk) {
      batch.delete(documentSnapshot.ref);
    }

    await batch.commit();
  }

  for (const churchChunk of chunk(churchesToReset, 400)) {
    const batch = firestore.batch();
    const updatedAt = new Date().toISOString();

    for (const documentSnapshot of churchChunk) {
      batch.set(
        documentSnapshot.ref,
        {
          primaryRepresentativeId: null,
          autoPublishUpdates: false,
          lastRepresentativeActivityAt: null,
          updatedAt,
        },
        { merge: true },
      );
    }

    await batch.commit();
  }

  console.log("Launch reset complete.");
  console.log(JSON.stringify(preview, null, 2));
}

run().catch((error) => {
  console.error("Failed to reset launch access.", error);
  process.exitCode = 1;
});
