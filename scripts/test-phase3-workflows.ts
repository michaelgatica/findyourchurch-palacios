import { randomUUID } from "crypto";

import { config as loadEnv } from "dotenv";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { siteConfig } from "@/lib/config/site";
import { getChurchBySlugFromFirebase } from "@/lib/repositories/firebase-church-repository";
import { getChurchClaimRequestById } from "@/lib/repositories/firebase-claim-request-repository";
import { getPrimaryRepresentativeForChurch } from "@/lib/repositories/firebase-representative-repository";
import { createChurchSubmission } from "@/lib/repositories/submission-repository";
import {
  getUserByFirebaseUid,
  upsertUserProfile,
} from "@/lib/repositories/firebase-user-repository";
import {
  approveClaimRequest,
  denyClaimRequest,
  requestClaimMoreInfo,
} from "@/lib/services/admin-claim-review-service";
import {
  approveSubmission,
  denySubmission,
  requestSubmissionChanges,
} from "@/lib/services/admin-submission-service";
import { createPendingChurchClaimRequest } from "@/lib/services/church-claim-service";
import { queueSubmissionReceivedNotification } from "@/lib/services/notification-service";

loadEnv({
  path: ".env.local",
});

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

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
      "Missing an admin email. Set FIREBASE_ADMIN_SEED_EMAIL or ADMIN_NOTIFICATION_EMAIL in .env.local before running this script.",
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
  }

  return upsertUserProfile({
    firebaseUid: `phase-workflow-admin-${adminEmail.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
    name: "Find Your Church Workflow Admin",
    email: adminEmail,
    role: "admin",
  });
}

async function createWorkflowSubmission(label: string) {
  const timestampSuffix = `${Date.now()}-${label}`;
  const submission = await createChurchSubmission(
    {
      churchName: `Phase 3 Workflow Church ${timestampSuffix}`,
      addressLine1: "800 Review Queue Avenue",
      city: "Palacios",
      stateCode: "TX",
      postalCode: "77465",
      phone: "(361) 555-0133",
      email: `church-${timestampSuffix}@example.org`,
      denomination: "Independent",
      shortDescription:
        "Workflow verification listing used to confirm the admin approval and review pipeline.",
      serviceTimes: ["Sunday Worship - 10:00 AM"],
      primaryContactName: "Workflow Submitter",
      primaryContactEmail: `submitter-${timestampSuffix}@example.org`,
      primaryContactRole: "Church Administrator",
      primaryContactPhone: "(361) 555-0144",
      communicationConsent: true,
      termsAccepted: true,
      followUpEmailOptIn: false,
      languages: ["English"],
      additionalLeaders: [],
      ministryTags: ["Workflow"],
      childrenMinistryAvailable: true,
      youthMinistryAvailable: false,
      nurseryCareAvailable: false,
      spanishServiceAvailable: false,
      livestreamAvailable: false,
      wheelchairAccessible: true,
    },
    {
      churchPhotos: [],
    },
  );

  await queueSubmissionReceivedNotification(submission);
  return submission;
}

async function createClaimTester(label: string) {
  const uid = `phase3-claim-${label}-${randomUUID()}`;

  return upsertUserProfile({
    firebaseUid: uid,
    name: `Claim Tester ${label}`,
    email: `claim-${label}-${Date.now()}@example.org`,
    phone: "(361) 555-0177",
    role: "pending_user",
  });
}

async function run() {
  const adminProfile = await getAdminProfile();

  const approvedSubmission = await createWorkflowSubmission("approve");
  await approveSubmission({
    submissionId: approvedSubmission.id,
    adminUserId: adminProfile.id,
    adminMessage: "Phase 3 workflow approval verification.",
  });

  const changesSubmission = await createWorkflowSubmission("changes");
  await requestSubmissionChanges({
    submissionId: changesSubmission.id,
    adminUserId: adminProfile.id,
    adminMessage: "Please confirm the ministry details before publication.",
  });

  const deniedSubmission = await createWorkflowSubmission("deny");
  await denySubmission({
    submissionId: deniedSubmission.id,
    adminUserId: adminProfile.id,
    adminMessage: "This submission is intentionally denied for workflow verification.",
  });

  const publishedChurch = await getChurchBySlugFromFirebase(approvedSubmission.slug);

  if (!publishedChurch) {
    throw new Error("The approved church was not found in the churches collection.");
  }

  const approvingClaimant = await createClaimTester("approve");
  const approvedClaimRequest = await createPendingChurchClaimRequest({
    churchId: publishedChurch.id,
    requesterUserId: approvingClaimant.firebaseUid,
    requesterName: approvingClaimant.name,
    requesterEmail: approvingClaimant.email,
    requesterPhone: approvingClaimant.phone,
    requesterRoleTitle: "Pastor",
    relationshipToChurch: "Lead pastor and primary ministry contact for this church.",
    proofOrExplanation:
      "I oversee this church location and can provide additional verification on request.",
    communicationConsent: true,
    termsAccepted: true,
    followUpEmailOptIn: false,
  });
  await approveClaimRequest({
    claimRequestId: approvedClaimRequest.id,
    adminUserId: adminProfile.id,
  });

  const moreInfoClaimant = await createClaimTester("more-info");
  const moreInfoClaimRequest = await createPendingChurchClaimRequest({
    churchId: publishedChurch.id,
    requesterUserId: moreInfoClaimant.firebaseUid,
    requesterName: moreInfoClaimant.name,
    requesterEmail: moreInfoClaimant.email,
    requesterPhone: moreInfoClaimant.phone,
    requesterRoleTitle: "Staff Member",
    relationshipToChurch: "Weekly staff member helping coordinate the office and visitor follow-up.",
    proofOrExplanation:
      "I help manage front office communication, but I may need to share more verification details.",
    communicationConsent: true,
    termsAccepted: true,
    followUpEmailOptIn: false,
  });
  await requestClaimMoreInfo({
    claimRequestId: moreInfoClaimRequest.id,
    adminUserId: adminProfile.id,
    adminMessage: "Please send a church email address or additional proof of authorization.",
  });

  const deniedClaimant = await createClaimTester("deny");
  const deniedClaimRequest = await createPendingChurchClaimRequest({
    churchId: publishedChurch.id,
    requesterUserId: deniedClaimant.firebaseUid,
    requesterName: deniedClaimant.name,
    requesterEmail: deniedClaimant.email,
    requesterPhone: deniedClaimant.phone,
    requesterRoleTitle: "Volunteer",
    relationshipToChurch: "Volunteer helping with occasional events and weekend setup.",
    proofOrExplanation:
      "I sometimes help at the church, but I am not the main contact for ownership and updates.",
    communicationConsent: true,
    termsAccepted: true,
    followUpEmailOptIn: false,
  });
  await denyClaimRequest({
    claimRequestId: deniedClaimRequest.id,
    adminUserId: adminProfile.id,
    adminMessage: "A primary pastor or authorized church staff member is needed for ownership.",
  });

  const primaryRepresentative = await getPrimaryRepresentativeForChurch(publishedChurch.id);
  const approvedClaimRecord = await getChurchClaimRequestById(approvedClaimRequest.id);
  const moreInfoClaimRecord = await getChurchClaimRequestById(moreInfoClaimRequest.id);
  const deniedClaimRecord = await getChurchClaimRequestById(deniedClaimRequest.id);

  console.log(
    JSON.stringify(
      {
        adminId: adminProfile.id,
        approvedSubmission: {
          id: approvedSubmission.id,
          slug: approvedSubmission.slug,
          resultingChurchId: publishedChurch.id,
          status: "approved",
        },
        changesRequestedSubmission: {
          id: changesSubmission.id,
          status: "changes_requested",
        },
        deniedSubmission: {
          id: deniedSubmission.id,
          status: "denied",
        },
        approvedClaim: {
          id: approvedClaimRequest.id,
          status: approvedClaimRecord?.status,
          representativeId: primaryRepresentative?.id,
        },
        moreInfoClaim: {
          id: moreInfoClaimRequest.id,
          status: moreInfoClaimRecord?.status,
        },
        deniedClaim: {
          id: deniedClaimRequest.id,
          status: deniedClaimRecord?.status,
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("Failed Phase 3 workflow verification.", error);
  process.exitCode = 1;
});
