import { buildChurchProfilePath } from "@/lib/config/site";
import {
  createServiceTime,
  createTag,
  mapDraftToChurchDocument,
  mapChurchDocumentToChurchRecord,
} from "@/lib/firebase/firestore";
import { uploadChurchAssetsToFirebaseStorage } from "@/lib/firebase/storage";
import { safeRevalidatePath } from "@/lib/revalidation";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  getChurchByIdFromFirebase,
  getChurchDocumentByIdFromFirebase,
  saveChurchDocumentToFirebase,
} from "@/lib/repositories/firebase-church-repository";
import {
  createChurchUpdateRequestInFirebase,
  listChurchUpdateRequests,
} from "@/lib/repositories/firebase-update-request-repository";
import type { ChurchListingDraft, ChurchPhoto, ChurchRecord } from "@/lib/types/directory";
import type {
  ValidatedChurchListingUpdateInput,
  ValidatedUploadFile,
} from "@/lib/validation/church-listing-update";

import {
  sendRepresentativeUpdateAutoPublishedNotification,
  sendRepresentativeUpdateSubmittedNotification,
} from "@/lib/services/notification-service";

function createUploadedPhotoRecords(
  churchName: string,
  uploads: Awaited<ReturnType<typeof uploadChurchAssetsToFirebaseStorage>>,
  existingPhotoCount: number,
) {
  return uploads
    .filter((uploadRecord) => uploadRecord.kind === "photo")
    .map<ChurchPhoto>((uploadRecord, index) => ({
      id: uploadRecord.id,
      src: uploadRecord.downloadUrl ?? uploadRecord.relativePath,
      alt: `${churchName} church photo ${existingPhotoCount + index + 1}`,
      sortOrder: existingPhotoCount + index + 1,
    }));
}

function buildChurchDraftFromUpdateInput(input: {
  currentChurch: ChurchRecord;
  validatedInput: ValidatedChurchListingUpdateInput;
  uploads: Awaited<ReturnType<typeof uploadChurchAssetsToFirebaseStorage>>;
}): ChurchListingDraft {
  const logoUpload = input.uploads.find((uploadRecord) => uploadRecord.kind === "logo");
  const existingPhotos = input.validatedInput.selectedExistingPhotos.map((photo, index) => ({
    ...photo,
    sortOrder: index + 1,
  }));
  const uploadedPhotos = createUploadedPhotoRecords(
    input.validatedInput.churchName,
    input.uploads,
    existingPhotos.length,
  );

  return {
    cityId: input.validatedInput.cityId,
    countyId: input.validatedInput.countyId,
    stateId: input.validatedInput.stateId,
    name: input.validatedInput.churchName,
    logoSrc:
      logoUpload?.downloadUrl ??
      logoUpload?.relativePath ??
      (input.validatedInput.removeLogo ? null : input.currentChurch.logoSrc ?? null),
    photos: [...existingPhotos, ...uploadedPhotos],
    denomination: input.validatedInput.denomination,
    specificAffiliation: input.validatedInput.specificAffiliation,
    clergyLabel: input.validatedInput.clergyName
      ? "Pastor / Priest / Reverend"
      : input.currentChurch.clergyLabel,
    primaryClergyName: input.validatedInput.clergyName,
    additionalLeaders: input.validatedInput.additionalLeaders,
    description: input.validatedInput.shortDescription,
    statementOfFaith: input.validatedInput.statementOfFaith,
    serviceTimes: input.validatedInput.serviceTimes.map(createServiceTime),
    address: {
      line1: input.validatedInput.addressLine1,
      line2: input.validatedInput.addressLine2,
      city: input.validatedInput.city,
      stateCode: input.validatedInput.stateCode,
      postalCode: input.validatedInput.postalCode,
      countyId: input.validatedInput.countyId,
      countryCode: "US",
      latitude: input.currentChurch.address.latitude,
      longitude: input.currentChurch.address.longitude,
    },
    phone: input.validatedInput.phone,
    email: input.validatedInput.email,
    website: input.validatedInput.websiteUrl,
    socialLinks: {
      facebook: input.validatedInput.facebookUrl,
      instagram: input.validatedInput.instagramUrl,
      youtube: input.validatedInput.youtubeUrl,
    },
    worshipStyle: input.validatedInput.worshipStyle,
    languages: input.validatedInput.languages,
    features: {
      childrenMinistry: input.validatedInput.childrenMinistryAvailable,
      youthMinistry: input.validatedInput.youthMinistryAvailable,
      nurseryCare: input.validatedInput.nurseryCareAvailable,
      spanishService: input.validatedInput.spanishServiceAvailable,
      livestream: input.validatedInput.livestreamAvailable,
      wheelchairAccessible: input.validatedInput.wheelchairAccessible,
    },
    accessibilityDetails: input.validatedInput.accessibilityDetails,
    visitorParkingDetails: input.validatedInput.visitorParkingDetails,
    firstTimeVisitorNotes: input.validatedInput.firstTimeVisitorNotes,
    livestreamDetails: input.currentChurch.livestreamDetails,
    onlineGivingUrl: input.validatedInput.onlineGivingUrl,
    ministryTags: input.validatedInput.ministryTags.map(createTag),
    lastVerifiedAt: input.currentChurch.lastVerifiedAt ?? null,
  };
}

export async function submitRepresentativeChurchUpdate(input: {
  currentChurch: ChurchRecord;
  validatedInput: ValidatedChurchListingUpdateInput;
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  };
  submittedByUserId: string;
  submittedByRepresentativeId: string;
  representativeEmail: string;
}) {
  const currentChurch =
    (await getChurchByIdFromFirebase(input.currentChurch.id)) ?? input.currentChurch;
  const uploadedAssets = await uploadChurchAssetsToFirebaseStorage(input.currentChurch.id, input.uploads);
  const proposedChanges = buildChurchDraftFromUpdateInput({
    currentChurch,
    validatedInput: input.validatedInput,
    uploads: uploadedAssets,
  });
  const now = new Date().toISOString();

  if (currentChurch.autoPublishUpdates) {
    const churchDocument = await getChurchDocumentByIdFromFirebase(input.currentChurch.id);

    if (!churchDocument) {
      throw new Error("The church listing could not be found.");
    }

    const updatedChurchDocument = mapDraftToChurchDocument(
      input.currentChurch.id,
      input.currentChurch.slug,
      proposedChanges,
      "published",
      churchDocument.createdAt,
      now,
    );

    updatedChurchDocument.primaryRepresentativeId =
      churchDocument.primaryRepresentativeId ?? null;
    updatedChurchDocument.autoPublishUpdates =
      churchDocument.autoPublishUpdates ?? false;
    updatedChurchDocument.publishedAt = churchDocument.publishedAt ?? now;
    updatedChurchDocument.lastVerifiedAt = now;

    const updatedChurch = await saveChurchDocumentToFirebase(updatedChurchDocument);
    const updateRequest = await createChurchUpdateRequestInFirebase({
      churchId: currentChurch.id,
      submittedByUserId: input.submittedByUserId,
      submittedByRepresentativeId: input.submittedByRepresentativeId,
      proposedChanges,
      status: "approved",
      source: "church_portal",
      autoPublished: true,
      reviewedBy: input.submittedByUserId,
      approvedAt: now,
    });

    await createAuditLogInFirebase({
      entityType: "churchUpdateRequest",
      entityId: updateRequest.id,
      action: "representative_listing_update_auto_published",
      actorId: input.submittedByUserId,
      actorType: "church_rep",
      after: updateRequest,
      note: "Representative changes were auto-published immediately.",
    });
    await sendRepresentativeUpdateAutoPublishedNotification({
      church: updatedChurch,
      representativeEmail: input.representativeEmail,
      updateRequest,
    });

    safeRevalidatePath("/portal");
    safeRevalidatePath("/portal/church");
    safeRevalidatePath("/portal/updates");
    safeRevalidatePath("/admin");
    safeRevalidatePath("/admin/updates");
    safeRevalidatePath("/churches");
    safeRevalidatePath(buildChurchProfilePath(updatedChurch.slug));

    return {
      mode: "auto_published" as const,
      church: updatedChurch,
      updateRequest,
    };
  }

  const updateRequest = await createChurchUpdateRequestInFirebase({
    churchId: currentChurch.id,
    submittedByUserId: input.submittedByUserId,
    submittedByRepresentativeId: input.submittedByRepresentativeId,
    proposedChanges,
  });

  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: "representative_listing_update_submitted",
    actorId: input.submittedByUserId,
    actorType: "church_rep",
    after: updateRequest,
    note: "Representative listing changes were submitted for admin review.",
  });
  await sendRepresentativeUpdateSubmittedNotification({
    church: currentChurch,
    representativeEmail: input.representativeEmail,
    updateRequest,
  });

  safeRevalidatePath("/portal");
  safeRevalidatePath("/portal/updates");
  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/updates");

  return {
      mode: "pending_review" as const,
      church: currentChurch,
      updateRequest,
    };
}

export async function getRepresentativeUpdateActivity(churchId: string) {
  return listChurchUpdateRequests({
    churchId,
    limit: 10,
  });
}

export async function buildApprovedChurchRecordFromDraft(input: {
  church: ChurchRecord;
  proposedChanges: ChurchListingDraft;
  updatedAt?: string;
}) {
  const churchDocument = await getChurchDocumentByIdFromFirebase(input.church.id);

  if (!churchDocument) {
    throw new Error("The church listing could not be found.");
  }

  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const updatedDocument = mapDraftToChurchDocument(
    input.church.id,
    input.church.slug,
    input.proposedChanges,
    "published",
    churchDocument.createdAt,
    updatedAt,
  );

  updatedDocument.primaryRepresentativeId =
    churchDocument.primaryRepresentativeId ?? null;
  updatedDocument.autoPublishUpdates = churchDocument.autoPublishUpdates ?? false;
  updatedDocument.publishedAt = churchDocument.publishedAt ?? updatedAt;
  updatedDocument.lastVerifiedAt = updatedAt;

  await saveChurchDocumentToFirebase(updatedDocument);

  return mapChurchDocumentToChurchRecord(updatedDocument);
}
