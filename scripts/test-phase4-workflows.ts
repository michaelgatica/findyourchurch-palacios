import { randomUUID } from "crypto";

import { config as loadEnv } from "dotenv";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { siteConfig } from "@/lib/config/site";
import { listAuditLogsForEntity } from "@/lib/repositories/firebase-audit-log-repository";
import { getChurchBySlugFromFirebase } from "@/lib/repositories/firebase-church-repository";
import { listEmailLogsForEntity } from "@/lib/repositories/firebase-email-log-repository";
import { listMessagesForChurch } from "@/lib/repositories/firebase-message-repository";
import { getOwnershipTransferRequestById } from "@/lib/repositories/firebase-ownership-transfer-repository";
import {
  getActiveEditorForChurch,
  getPrimaryRepresentativeForChurch,
  getRepresentativeById,
  getRepresentativeForChurchUser,
} from "@/lib/repositories/firebase-representative-repository";
import { getChurchUpdateRequestById } from "@/lib/repositories/firebase-update-request-repository";
import {
  getUserByFirebaseUid,
  upsertUserProfile,
} from "@/lib/repositories/firebase-user-repository";
import {
  approveClaimRequest,
} from "@/lib/services/admin-claim-review-service";
import {
  approveUpdateRequest,
  denyUpdateRequest,
  requestUpdateChanges,
} from "@/lib/services/admin-update-review-service";
import {
  sendAdminChurchMessage,
  sendRepresentativeChurchMessage,
} from "@/lib/services/church-messaging-service";
import { createPendingChurchClaimRequest } from "@/lib/services/church-claim-service";
import { submitRepresentativeChurchUpdate } from "@/lib/services/church-update-service";
import {
  activateMatchingRepresentativeInvites,
  requireRepresentativeChurchAccess,
} from "@/lib/services/representative-access-service";
import {
  approveOwnershipTransferRequest,
  createOwnershipTransferRequest,
  denyOwnershipTransferRequest,
  inviteChurchEditor,
  suspendRepresentativeAccess,
  toggleChurchAutoPublishUpdates,
} from "@/lib/services/representative-team-service";
import {
  createChurchSubmission,
} from "@/lib/repositories/submission-repository";
import { approveSubmission } from "@/lib/services/admin-submission-service";
import type { ChurchPhoto, ChurchRecord } from "@/lib/types/directory";

loadEnv({
  path: ".env.local",
});

function getConfiguredAdminEmail() {
  return (
    process.env.FIREBASE_ADMIN_SEED_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    siteConfig.contactEmail
  );
}

function getFirebaseAuthErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "errorInfo" in error &&
    typeof error.errorInfo === "object" &&
    error.errorInfo !== null &&
    "code" in error.errorInfo &&
    typeof error.errorInfo.code === "string"
  ) {
    return error.errorInfo.code;
  }

  return null;
}

async function getAdminProfile() {
  const auth = getFirebaseAdminAuth();

  if (!auth) {
    throw new Error("Firebase Admin Auth is not configured.");
  }

  const adminEmail = getConfiguredAdminEmail();

  if (!adminEmail) {
    throw new Error(
      "Missing an admin email. Set FIREBASE_ADMIN_SEED_EMAIL or ADMIN_NOTIFICATION_EMAIL before running this script.",
    );
  }

  try {
    const authUser = await auth.getUserByEmail(adminEmail);
    const existingProfile = await getUserByFirebaseUid(authUser.uid);

    if (existingProfile?.role === "admin") {
      return existingProfile;
    }

    return upsertUserProfile({
      firebaseUid: authUser.uid,
      name: authUser.displayName ?? "Find Your Church Admin",
      email: authUser.email ?? adminEmail,
      phone: authUser.phoneNumber ?? undefined,
      role: "admin",
    });
  } catch (error) {
    if (getFirebaseAuthErrorCode(error) !== "auth/user-not-found") {
      throw error;
    }

    return upsertUserProfile({
      firebaseUid: `phase-workflow-admin-${adminEmail.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
      name: "Find Your Church Workflow Admin",
      email: adminEmail,
      role: "admin",
    });
  }
}

async function createWorkflowSubmission(label: string) {
  const timestampSuffix = `${Date.now()}-${label}`;

  return createChurchSubmission(
    {
      churchName: `Phase 4 Workflow Church ${timestampSuffix}`,
      addressLine1: "901 Representative Way",
      city: "Palacios",
      stateCode: "TX",
      postalCode: "77465",
      phone: "(361) 555-0248",
      email: `phase4-${timestampSuffix}@example.org`,
      denomination: "Independent",
      shortDescription:
        "Representative workflow verification church used to test the Phase 4 portal features.",
      serviceTimes: ["Sunday Worship - 10:30 AM"],
      primaryContactName: "Phase 4 Submitter",
      primaryContactEmail: `submitter-${timestampSuffix}@example.org`,
      primaryContactRole: "Church Administrator",
      primaryContactPhone: "(361) 555-0249",
      languages: ["English"],
      additionalLeaders: [],
      ministryTags: ["Verification"],
      childrenMinistryAvailable: true,
      youthMinistryAvailable: true,
      nurseryCareAvailable: false,
      spanishServiceAvailable: false,
      livestreamAvailable: false,
      wheelchairAccessible: true,
    },
    {
      churchPhotos: [],
    },
  );
}

async function createPortalUser(label: string) {
  const uid = `phase4-${label}-${randomUUID()}`;

  return upsertUserProfile({
    firebaseUid: uid,
    name: `Phase 4 ${label}`,
    email: `${label}-${Date.now()}@example.org`,
    phone: "(361) 555-0211",
    role: "pending_user",
  });
}

function buildValidatedInput(church: ChurchRecord, overrides?: Partial<{
  churchName: string;
  shortDescription: string;
  serviceTimes: string[];
  selectedExistingPhotos: ChurchPhoto[];
}>) {
  return {
    churchId: church.id,
    churchSlug: church.slug,
    churchName: overrides?.churchName ?? church.name,
    addressLine1: church.address.line1,
    addressLine2: church.address.line2,
    city: church.address.city,
    county: "Matagorda County",
    stateCode: church.address.stateCode,
    postalCode: church.address.postalCode,
    phone: church.phone,
    email: church.email ?? "",
    websiteUrl: church.website,
    facebookUrl: church.socialLinks.facebook,
    youtubeUrl: church.socialLinks.youtube,
    instagramUrl: church.socialLinks.instagram,
    clergyName: church.primaryClergyName,
    additionalLeaders: church.additionalLeaders,
    denomination: church.denomination,
    specificAffiliation: church.specificAffiliation,
    shortDescription:
      overrides?.shortDescription ??
      `${church.description} Updated ${Date.now()}`.slice(0, 300),
    statementOfFaith: church.statementOfFaith,
    worshipStyle: church.worshipStyle,
    serviceTimes:
      overrides?.serviceTimes ??
      church.serviceTimes.map((serviceTime) => serviceTime.label),
    languages: church.languages,
    onlineGivingUrl: church.onlineGivingUrl,
    accessibilityDetails: church.accessibilityDetails,
    visitorParkingDetails: church.visitorParkingDetails,
    firstTimeVisitorNotes: church.firstTimeVisitorNotes,
    ministryTags: church.ministryTags.map((tag) => tag.label),
    spanishServiceAvailable: church.features.spanishService,
    livestreamAvailable: church.features.livestream,
    childrenMinistryAvailable: church.features.childrenMinistry,
    youthMinistryAvailable: church.features.youthMinistry,
    nurseryCareAvailable: church.features.nurseryCare,
    wheelchairAccessible: church.features.wheelchairAccessible,
    removeLogo: false,
    selectedExistingPhotos: overrides?.selectedExistingPhotos ?? church.photos,
    cityId: church.cityId,
    countyId: church.countyId,
    stateId: church.stateId,
  };
}

async function run() {
  const adminProfile = await getAdminProfile();
  const approvedSubmission = await createWorkflowSubmission("base");

  await approveSubmission({
    submissionId: approvedSubmission.id,
    adminUserId: adminProfile.id,
    adminMessage: "Phase 4 workflow base church approval.",
  });

  const church = await getChurchBySlugFromFirebase(approvedSubmission.slug);

  if (!church) {
    throw new Error("The approved workflow church could not be found.");
  }

  const primaryClaimant = await createPortalUser("primary-owner");
  const primaryClaim = await createPendingChurchClaimRequest({
    churchId: church.id,
    requesterUserId: primaryClaimant.firebaseUid,
    requesterName: primaryClaimant.name,
    requesterEmail: primaryClaimant.email,
    requesterPhone: primaryClaimant.phone,
    requesterRoleTitle: "Pastor",
    relationshipToChurch: "Lead pastor and primary church contact for this listing.",
    proofOrExplanation: "I oversee this church and approve directory information updates.",
  });
  await approveClaimRequest({
    claimRequestId: primaryClaim.id,
    adminUserId: adminProfile.id,
  });

  const primaryRepresentative = await getPrimaryRepresentativeForChurch(church.id);

  if (!primaryRepresentative || !primaryRepresentative.userId) {
    throw new Error("The primary representative was not assigned after claim approval.");
  }

  await toggleChurchAutoPublishUpdates({
    churchId: church.id,
    adminUserId: adminProfile.id,
    autoPublishUpdates: true,
  });

  const autoPublishedResult = await submitRepresentativeChurchUpdate({
    currentChurch: church,
    validatedInput: buildValidatedInput(church, {
      shortDescription:
        "Auto-publish verification update applied directly to the published church listing.",
    }),
    uploads: {
      churchPhotos: [],
    },
    submittedByUserId: primaryClaimant.id,
    submittedByRepresentativeId: primaryRepresentative.id,
    representativeEmail: primaryClaimant.email,
  });

  const churchAfterAutoPublish = await getChurchBySlugFromFirebase(church.slug);

  if (
    autoPublishedResult.mode !== "auto_published" ||
    churchAfterAutoPublish?.description !==
      "Auto-publish verification update applied directly to the published church listing."
  ) {
    throw new Error("Auto-publish workflow did not update the public church record.");
  }

  await toggleChurchAutoPublishUpdates({
    churchId: church.id,
    adminUserId: adminProfile.id,
    autoPublishUpdates: false,
  });

  const reviewPendingResult = await submitRepresentativeChurchUpdate({
    currentChurch: churchAfterAutoPublish,
    validatedInput: buildValidatedInput(churchAfterAutoPublish, {
      shortDescription:
        "Pending review verification update that should remain hidden until admin approval.",
    }),
    uploads: {
      churchPhotos: [],
    },
    submittedByUserId: primaryClaimant.id,
    submittedByRepresentativeId: primaryRepresentative.id,
    representativeEmail: primaryClaimant.email,
  });

  const churchAfterPendingSubmission = await getChurchBySlugFromFirebase(church.slug);

  if (
    reviewPendingResult.mode !== "pending_review" ||
    churchAfterPendingSubmission?.description !== churchAfterAutoPublish?.description
  ) {
    throw new Error("Pending review updates should not change the public listing immediately.");
  }

  await approveUpdateRequest({
    updateRequestId: reviewPendingResult.updateRequest.id,
    adminUserId: adminProfile.id,
  });

  const approvedUpdateRequest = await getChurchUpdateRequestById(reviewPendingResult.updateRequest.id);
  const churchAfterUpdateApproval = await getChurchBySlugFromFirebase(church.slug);

  if (
    approvedUpdateRequest?.status !== "approved" ||
    churchAfterUpdateApproval?.description !==
      "Pending review verification update that should remain hidden until admin approval."
  ) {
    throw new Error("Approved representative updates did not publish correctly.");
  }

  const changesRequestedResult = await submitRepresentativeChurchUpdate({
    currentChurch: churchAfterUpdateApproval,
    validatedInput: buildValidatedInput(churchAfterUpdateApproval, {
      shortDescription: "Changes requested verification update.",
    }),
    uploads: {
      churchPhotos: [],
    },
    submittedByUserId: primaryClaimant.id,
    submittedByRepresentativeId: primaryRepresentative.id,
    representativeEmail: primaryClaimant.email,
  });
  await requestUpdateChanges({
    updateRequestId: changesRequestedResult.updateRequest.id,
    adminUserId: adminProfile.id,
    adminMessage: "Please clarify the service time wording before publishing these updates.",
  });

  const deniedUpdateResult = await submitRepresentativeChurchUpdate({
    currentChurch: churchAfterUpdateApproval,
    validatedInput: buildValidatedInput(churchAfterUpdateApproval, {
      shortDescription: "Denied verification update.",
    }),
    uploads: {
      churchPhotos: [],
    },
    submittedByUserId: primaryClaimant.id,
    submittedByRepresentativeId: primaryRepresentative.id,
    representativeEmail: primaryClaimant.email,
  });
  await denyUpdateRequest({
    updateRequestId: deniedUpdateResult.updateRequest.id,
    adminUserId: adminProfile.id,
    adminMessage: "This verification update is intentionally denied by the script.",
  });

  const editorInvite = await inviteChurchEditor({
    churchId: church.id,
    actorUserId: primaryClaimant.id,
    editorName: "Phase 4 Editor",
    editorEmail: `phase4-editor-${Date.now()}@example.org`,
    editorRoleTitle: "Office Administrator",
  });

  let secondInviteBlocked = false;
  try {
    await inviteChurchEditor({
      churchId: church.id,
      actorUserId: primaryClaimant.id,
      editorName: "Second Editor",
      editorEmail: `phase4-editor-two-${Date.now()}@example.org`,
      editorRoleTitle: "Assistant",
    });
  } catch {
    secondInviteBlocked = true;
  }

  if (!secondInviteBlocked) {
    throw new Error("A second editor invite should have been blocked.");
  }

  const invitedEditorUser = await upsertUserProfile({
    firebaseUid: `phase4-editor-${randomUUID()}`,
    name: "Activated Editor",
    email: editorInvite.email,
    phone: "(361) 555-0298",
    role: "pending_user",
  });
  await activateMatchingRepresentativeInvites({
    profile: invitedEditorUser,
  });

  const activeEditor = await getActiveEditorForChurch(church.id);

  if (activeEditor?.status !== "active") {
    throw new Error("Invited editor did not activate correctly.");
  }

  const ownershipTransferRequest = await createOwnershipTransferRequest({
    churchId: church.id,
    actorUserId: primaryClaimant.id,
    newOwnerName: "Phase 4 New Owner",
    newOwnerEmail: `phase4-new-owner-${Date.now()}@example.org`,
    newOwnerPhone: "(361) 555-0301",
    newOwnerRoleTitle: "Executive Pastor",
    reasonMessage: "Leadership handoff verification for Phase 4 workflow coverage.",
  });
  const newOwnerUser = await upsertUserProfile({
    firebaseUid: `phase4-new-owner-${randomUUID()}`,
    name: "Phase 4 New Owner",
    email: ownershipTransferRequest.newOwnerEmail,
    phone: ownershipTransferRequest.newOwnerPhone,
    role: "pending_user",
  });

  await approveOwnershipTransferRequest({
    transferRequestId: ownershipTransferRequest.id,
    adminUserId: adminProfile.id,
  });

  const approvedTransferRecord = await getOwnershipTransferRequestById(ownershipTransferRequest.id);
  const newPrimaryRepresentative = await getRepresentativeForChurchUser(
    church.id,
    newOwnerUser.id,
  );
  const formerPrimaryRepresentative = await getRepresentativeById(primaryRepresentative.id);

  if (
    approvedTransferRecord?.status !== "approved" ||
    newPrimaryRepresentative?.permissionRole !== "primary_owner" ||
    formerPrimaryRepresentative?.status !== "transferred"
  ) {
    throw new Error("Ownership transfer approval did not update representative ownership correctly.");
  }

  const deniedTransferRequest = await createOwnershipTransferRequest({
    churchId: church.id,
    actorUserId: newOwnerUser.id,
    newOwnerName: "Denied Transfer Candidate",
    newOwnerEmail: `phase4-denied-owner-${Date.now()}@example.org`,
    newOwnerRoleTitle: "Volunteer",
    reasonMessage: "Intentional denial branch verification.",
  });
  await denyOwnershipTransferRequest({
    transferRequestId: deniedTransferRequest.id,
    adminUserId: adminProfile.id,
    adminMessage: "This transfer is intentionally denied for workflow coverage.",
  });
  const deniedTransferRecord = await getOwnershipTransferRequestById(deniedTransferRequest.id);

  if (deniedTransferRecord?.status !== "denied") {
    throw new Error("Denied ownership transfer did not persist its status.");
  }

  let unassignedBlocked = false;
  const outsider = await createPortalUser("outsider");

  try {
    await requireRepresentativeChurchAccess({
      userId: outsider.id,
      churchId: church.id,
    });
  } catch {
    unassignedBlocked = true;
  }

  if (!unassignedBlocked) {
    throw new Error("Unassigned users should not be able to manage a church listing.");
  }

  await suspendRepresentativeAccess({
    churchId: church.id,
    representativeId: activeEditor.id,
    adminUserId: adminProfile.id,
  });

  let suspendedBlocked = false;
  try {
    await requireRepresentativeChurchAccess({
      userId: invitedEditorUser.id,
      churchId: church.id,
    });
  } catch {
    suspendedBlocked = true;
  }

  if (!suspendedBlocked) {
    throw new Error("Suspended representatives should not be able to manage a church listing.");
  }

  await sendRepresentativeChurchMessage({
    churchId: church.id,
    senderUserId: newOwnerUser.id,
    messageBody: "Phase 4 representative message verification.",
  });
  await sendAdminChurchMessage({
    churchId: church.id,
    adminUserId: adminProfile.id,
    recipientEmail: newOwnerUser.email,
    messageBody: "Phase 4 admin message verification.",
  });

  const [updateAuditLogs, updateEmailLogs, transferAuditLogs, churchMessages] = await Promise.all([
    listAuditLogsForEntity("churchUpdateRequest", reviewPendingResult.updateRequest.id),
    listEmailLogsForEntity("churchUpdateRequest", reviewPendingResult.updateRequest.id),
    listAuditLogsForEntity("ownershipTransferRequest", ownershipTransferRequest.id),
    listMessagesForChurch(church.id),
  ]);

  if (updateAuditLogs.length === 0 || updateEmailLogs.length === 0 || transferAuditLogs.length === 0) {
    throw new Error("Audit or email logs were not created as expected.");
  }

  console.log(
    JSON.stringify(
      {
        adminId: adminProfile.id,
        churchId: church.id,
        autoPublishedUpdate: {
          id: autoPublishedResult.updateRequest.id,
          status: autoPublishedResult.updateRequest.status,
          mode: autoPublishedResult.mode,
        },
        approvedPendingUpdate: {
          id: reviewPendingResult.updateRequest.id,
          status: approvedUpdateRequest?.status,
        },
        changesRequestedUpdate: {
          id: changesRequestedResult.updateRequest.id,
          status: (await getChurchUpdateRequestById(changesRequestedResult.updateRequest.id))?.status,
        },
        deniedUpdate: {
          id: deniedUpdateResult.updateRequest.id,
          status: (await getChurchUpdateRequestById(deniedUpdateResult.updateRequest.id))?.status,
        },
        editorInvite: {
          representativeId: editorInvite.id,
          status: (await getRepresentativeById(editorInvite.id))?.status,
          secondInviteBlocked,
        },
        ownershipTransfer: {
          approvedTransferId: ownershipTransferRequest.id,
          approvedStatus: approvedTransferRecord?.status,
          newPrimaryRepresentativeId: newPrimaryRepresentative?.id,
          deniedTransferId: deniedTransferRequest.id,
          deniedStatus: deniedTransferRecord?.status,
        },
        permissions: {
          unassignedBlocked,
          suspendedBlocked,
        },
        messages: {
          totalChurchMessages: churchMessages.length,
        },
        logs: {
          updateAuditLogs: updateAuditLogs.length,
          updateEmailLogs: updateEmailLogs.length,
          transferAuditLogs: transferAuditLogs.length,
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("Failed Phase 4 workflow verification.", error);
  process.exitCode = 1;
});
