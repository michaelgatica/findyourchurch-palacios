import { config as loadEnv } from "dotenv";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";

loadEnv({
  path: ".env.local",
});

const testPrefixes = [
  "phase-3-workflow-church-",
  "phase-4-workflow-church-",
  "repository-test-church-",
] as const;

function isWorkflowSlug(value?: string | null) {
  return testPrefixes.some((prefix) => value?.startsWith(prefix));
}

function isWorkflowEmail(value?: string | null) {
  return value?.includes("@example.org") ?? false;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function run() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run");

  if (!confirm && !dryRun) {
    throw new Error(
      "Refusing to remove workflow test data without --confirm or --dry-run. This script deletes Firebase submission verification records plus Phase 3 and Phase 4 workflow verification records in Firestore.",
    );
  }

  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const [
    churchesSnapshot,
    submissionsSnapshot,
    representativesSnapshot,
    claimRequestsSnapshot,
    updateRequestsSnapshot,
    transferRequestsSnapshot,
    usersSnapshot,
    messagesSnapshot,
    auditLogsSnapshot,
    emailLogsSnapshot,
  ] = await Promise.all([
    firestore.collection(firestoreCollectionNames.churches).get(),
    firestore.collection(firestoreCollectionNames.churchSubmissions).get(),
    firestore.collection(firestoreCollectionNames.churchRepresentatives).get(),
    firestore.collection(firestoreCollectionNames.churchClaimRequests).get(),
    firestore.collection(firestoreCollectionNames.churchUpdateRequests).get(),
    firestore.collection(firestoreCollectionNames.ownershipTransferRequests).get(),
    firestore.collection(firestoreCollectionNames.users).get(),
    firestore.collection(firestoreCollectionNames.messages).get(),
    firestore.collection(firestoreCollectionNames.auditLogs).get(),
    firestore.collection(firestoreCollectionNames.emailLogs).get(),
  ]);

  const churchDocs = churchesSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      isWorkflowSlug(String(data.slug ?? "")) ||
      String(data.name ?? "").startsWith("Phase 3 Workflow Church") ||
      String(data.name ?? "").startsWith("Phase 4 Workflow Church") ||
      String(data.name ?? "").startsWith("Repository Test Church")
    );
  });
  const churchIds = new Set(churchDocs.map((documentSnapshot) => documentSnapshot.id));

  const submissionDocs = submissionsSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    const draft = asRecord(data.churchDraft);
    return (
      isWorkflowSlug(String(data.slug ?? "")) ||
      String(draft.name ?? "").startsWith("Phase 3 Workflow Church") ||
      String(draft.name ?? "").startsWith("Phase 4 Workflow Church") ||
      String(draft.name ?? "").startsWith("Repository Test Church")
    );
  });
  const submissionIds = new Set(submissionDocs.map((documentSnapshot) => documentSnapshot.id));

  const representativeDocs = representativesSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      churchIds.has(String(data.churchId ?? "")) ||
      String(data.name ?? "").startsWith("Phase 4") ||
      isWorkflowEmail(String(data.email ?? ""))
    );
  });
  const representativeIds = new Set(
    representativeDocs.map((documentSnapshot) => documentSnapshot.id),
  );

  const claimRequestDocs = claimRequestsSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      churchIds.has(String(data.churchId ?? "")) ||
      String(data.requesterName ?? "").startsWith("Claim Tester") ||
      String(data.requesterName ?? "").startsWith("Phase 4") ||
      isWorkflowEmail(String(data.requesterEmail ?? ""))
    );
  });
  const claimRequestIds = new Set(
    claimRequestDocs.map((documentSnapshot) => documentSnapshot.id),
  );

  const updateRequestDocs = updateRequestsSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    const proposedChanges = asRecord(data.proposedChanges);
    return (
      churchIds.has(String(data.churchId ?? "")) ||
      String(proposedChanges.name ?? "").startsWith("Phase 4 Workflow Church")
    );
  });
  const updateRequestIds = new Set(
    updateRequestDocs.map((documentSnapshot) => documentSnapshot.id),
  );

  const transferRequestDocs = transferRequestsSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      churchIds.has(String(data.churchId ?? "")) ||
      String(data.newOwnerName ?? "").startsWith("Phase 4") ||
      isWorkflowEmail(String(data.newOwnerEmail ?? ""))
    );
  });
  const transferRequestIds = new Set(
    transferRequestDocs.map((documentSnapshot) => documentSnapshot.id),
  );

  const userDocs = usersSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      String(data.name ?? "").startsWith("Claim Tester") ||
      String(data.name ?? "").startsWith("Phase 4") ||
      (isWorkflowEmail(String(data.email ?? "")) &&
        (String(data.email ?? "").includes("claim-") ||
          String(data.email ?? "").includes("verification-") ||
          String(data.email ?? "").includes("contact-") ||
          String(data.email ?? "").includes("phase4-")))
    );
  });
  const userIds = new Set(userDocs.map((documentSnapshot) => documentSnapshot.id));

  const messageDocs = messagesSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      churchIds.has(String(data.churchId ?? "")) ||
      submissionIds.has(String(data.submissionId ?? "")) ||
      claimRequestIds.has(String(data.claimRequestId ?? "")) ||
      updateRequestIds.has(String(data.updateRequestId ?? "")) ||
      representativeIds.has(String(data.senderId ?? "")) ||
      userIds.has(String(data.senderId ?? "")) ||
      String(data.messageBody ?? "").includes("Phase 4")
    );
  });

  const auditLogDocs = auditLogsSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      churchIds.has(String(data.entityId ?? "")) ||
      submissionIds.has(String(data.entityId ?? "")) ||
      claimRequestIds.has(String(data.entityId ?? "")) ||
      updateRequestIds.has(String(data.entityId ?? "")) ||
      transferRequestIds.has(String(data.entityId ?? "")) ||
      representativeIds.has(String(data.entityId ?? "")) ||
      userIds.has(String(data.actorId ?? "")) ||
      String(data.note ?? "").includes("Phase 3") ||
      String(data.note ?? "").includes("Phase 4") ||
      String(data.note ?? "").includes("Repository Test")
    );
  });

  const emailLogDocs = emailLogsSnapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    return (
      submissionIds.has(String(data.relatedEntityId ?? "")) ||
      claimRequestIds.has(String(data.relatedEntityId ?? "")) ||
      updateRequestIds.has(String(data.relatedEntityId ?? "")) ||
      transferRequestIds.has(String(data.relatedEntityId ?? "")) ||
      churchIds.has(String(data.relatedEntityId ?? "")) ||
      isWorkflowEmail(String(data.to ?? "")) ||
      String(data.subject ?? "").includes("Phase 4")
    );
  });

  const allDocsToDelete = [
    ...messageDocs,
    ...emailLogDocs,
    ...auditLogDocs,
    ...transferRequestDocs,
    ...updateRequestDocs,
    ...claimRequestDocs,
    ...representativeDocs,
    ...submissionDocs,
    ...churchDocs,
    ...userDocs,
  ];

  if (allDocsToDelete.length === 0) {
    console.log("No verification test records were found.");
    return;
  }

  const preview = {
    churches: churchDocs.length,
    submissions: submissionDocs.length,
    representatives: representativeDocs.length,
    claimRequests: claimRequestDocs.length,
    updateRequests: updateRequestDocs.length,
    ownershipTransfers: transferRequestDocs.length,
    users: userDocs.length,
    messages: messageDocs.length,
    auditLogs: auditLogDocs.length,
    emailLogs: emailLogDocs.length,
  };

  console.log("Test verification records matched for cleanup:");
  console.log(JSON.stringify(preview, null, 2));

  if (dryRun) {
    console.log("Dry run complete. No records were deleted.");
    return;
  }

  const batchSize = 400;

  for (let index = 0; index < allDocsToDelete.length; index += batchSize) {
    const batch = firestore.batch();

    for (const documentSnapshot of allDocsToDelete.slice(index, index + batchSize)) {
      batch.delete(documentSnapshot.ref);
    }

    await batch.commit();
  }

  console.log("Test verification cleanup complete.");
  console.log(JSON.stringify(preview, null, 2));
}

run().catch((error) => {
  console.error("Failed to remove verification test data.", error);
  process.exitCode = 1;
});
