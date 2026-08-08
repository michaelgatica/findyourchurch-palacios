import { after } from "next/server";

import { getFirebaseAdminBucket } from "@/lib/firebase/admin";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import {
  claimQueuedChurchUpdateAiReviewInFirebase,
  queueChurchUpdateAiReviewInFirebase,
  updateChurchUpdateAiReviewInFirebase,
} from "@/lib/repositories/firebase-update-ai-review-repository";
import { getChurchUpdateRequestById } from "@/lib/repositories/firebase-update-request-repository";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { sendAiListingReviewNeedsHumanNotification } from "@/lib/services/notification-service";
import type {
  ChurchListingDraft,
  ChurchRecord,
  ChurchUpdateAiReview,
  ChurchUpdateAiReviewRecord,
  ChurchUpdateRequestRecord,
} from "@/lib/types/directory";

const openAiModerationsUrl = "https://api.openai.com/v1/moderations";
const moderationModel = "omni-moderation-latest";
const maxTextCharacters = 12_000;
const maxImagesPerReview = 6;
const maxImageBytes = 5 * 1024 * 1024;

export type AiListingReviewMode = "off" | "shadow" | "recommend";

export interface AiListingReviewConfiguration {
  mode: AiListingReviewMode;
  apiKey?: string;
  configurationError?: string;
}

interface ModerationInputText {
  type: "text";
  text: string;
}

interface ModerationInputImage {
  type: "image_url";
  image_url: { url: string };
}

type ModerationInput = ModerationInputText | ModerationInputImage;

interface ModerationResponse {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
  }>;
}

function normalize(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function valuesDiffer(left?: string | null, right?: string | null) {
  return normalize(left) !== normalize(right);
}

function serializeList(values?: string[] | null) {
  return (values ?? []).map(normalize).filter(Boolean).join(" | ");
}

function addChangedText(
  output: string[],
  label: string,
  currentValue: string | undefined | null,
  proposedValue: string | undefined | null,
) {
  const normalizedProposed = normalize(proposedValue);

  if (normalizedProposed && valuesDiffer(currentValue, proposedValue)) {
    output.push(`${label}: ${normalizedProposed}`);
  }
}

/**
 * Returns only changed, public-facing text. Contact details, physical and
 * mailing addresses, account identifiers, and private representative details
 * are intentionally excluded from the provider payload.
 */
export function buildChangedPublicListingText(
  currentChurch: ChurchRecord,
  proposedChanges: ChurchListingDraft,
) {
  const output: string[] = [];

  addChangedText(output, "Church name", currentChurch.name, proposedChanges.name);
  addChangedText(output, "Denomination", currentChurch.denomination, proposedChanges.denomination);
  addChangedText(
    output,
    "Specific affiliation",
    currentChurch.specificAffiliation,
    proposedChanges.specificAffiliation,
  );
  addChangedText(output, "Clergy label", currentChurch.clergyLabel, proposedChanges.clergyLabel);
  addChangedText(
    output,
    "Primary clergy name",
    currentChurch.primaryClergyName,
    proposedChanges.primaryClergyName,
  );
  addChangedText(
    output,
    "Additional leaders",
    serializeList(currentChurch.additionalLeaders),
    serializeList(proposedChanges.additionalLeaders),
  );
  addChangedText(output, "Listing description", currentChurch.description, proposedChanges.description);
  addChangedText(
    output,
    "Statement of faith",
    currentChurch.statementOfFaith,
    proposedChanges.statementOfFaith,
  );
  addChangedText(
    output,
    "Service times",
    currentChurch.serviceTimes.map((serviceTime) => serviceTime.label).join(" | "),
    proposedChanges.serviceTimes.map((serviceTime) => serviceTime.label).join(" | "),
  );
  addChangedText(output, "Worship style", currentChurch.worshipStyle, proposedChanges.worshipStyle);
  addChangedText(
    output,
    "Languages",
    serializeList(currentChurch.languages),
    serializeList(proposedChanges.languages),
  );
  addChangedText(
    output,
    "Accessibility details",
    currentChurch.accessibilityDetails,
    proposedChanges.accessibilityDetails,
  );
  addChangedText(
    output,
    "Visitor parking details",
    currentChurch.visitorParkingDetails,
    proposedChanges.visitorParkingDetails,
  );
  addChangedText(
    output,
    "First-time visitor notes",
    currentChurch.firstTimeVisitorNotes,
    proposedChanges.firstTimeVisitorNotes,
  );
  addChangedText(
    output,
    "Livestream details",
    currentChurch.livestreamDetails,
    proposedChanges.livestreamDetails,
  );
  addChangedText(
    output,
    "Ministry tags",
    currentChurch.ministryTags.map((tag) => tag.label).join(" | "),
    proposedChanges.ministryTags.map((tag) => tag.label).join(" | "),
  );

  return output.join("\n").slice(0, maxTextCharacters);
}

function getChangedImageSources(currentChurch: ChurchRecord, proposedChanges: ChurchListingDraft) {
  const currentPhotoSources = new Set(currentChurch.photos.map((photo) => photo.src));
  const imageSources: string[] = [];

  if (valuesDiffer(currentChurch.logoSrc, proposedChanges.logoSrc) && proposedChanges.logoSrc) {
    imageSources.push(proposedChanges.logoSrc);
  }

  for (const photo of proposedChanges.photos) {
    if (!currentPhotoSources.has(photo.src)) {
      imageSources.push(photo.src);
    }
  }

  return Array.from(new Set(imageSources)).slice(0, maxImagesPerReview);
}

function getChurchOwnedStoragePath(source: string, churchId: string) {
  try {
    const url = new URL(source);

    if (url.hostname !== "firebasestorage.googleapis.com") {
      return null;
    }

    const marker = "/o/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    const storagePath = decodeURIComponent(encodedPath);

    return storagePath.startsWith(`churches/${churchId}/`) ? storagePath : null;
  } catch {
    return null;
  }
}

async function loadChangedImagesForModeration(input: {
  churchId: string;
  sources: string[];
}) {
  const bucket = getFirebaseAdminBucket();

  if (!bucket) {
    return { inputs: [] as ModerationInputImage[], unavailable: input.sources.length > 0 };
  }

  const inputs: ModerationInputImage[] = [];
  let unavailable = false;

  for (const source of input.sources) {
    const storagePath = getChurchOwnedStoragePath(source, input.churchId);

    if (!storagePath) {
      unavailable = true;
      continue;
    }

    try {
      const file = bucket.file(storagePath);
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size ?? 0);
      const contentType = metadata.contentType ?? "";

      if (!contentType.startsWith("image/") || size < 1 || size > maxImageBytes) {
        unavailable = true;
        continue;
      }

      const [contents] = await file.download();
      inputs.push({
        type: "image_url",
        image_url: {
          // Keep Firebase download tokens inside our server boundary. The
          // moderation API receives image bytes, not a reusable Storage URL.
          url: `data:${contentType};base64,${contents.toString("base64")}`,
        },
      });
    } catch {
      unavailable = true;
    }
  }

  return { inputs, unavailable };
}

export function getAiListingReviewConfiguration(
  environment: Record<string, string | undefined> = process.env,
): AiListingReviewConfiguration {
  const rawMode = environment.AI_LISTING_REVIEW_MODE?.trim().toLowerCase() ?? "off";

  if (rawMode === "off") {
    return { mode: "off" };
  }

  if (rawMode !== "shadow" && rawMode !== "recommend") {
    return {
      mode: "off",
      configurationError: "AI_LISTING_REVIEW_MODE must be off, shadow, or recommend.",
    };
  }

  const apiKey = environment.OPENAI_MODERATION_API_KEY?.trim();

  return apiKey
    ? { mode: rawMode, apiKey }
    : {
        mode: rawMode,
        configurationError: "OPENAI_MODERATION_API_KEY is required when AI listing review is enabled.",
      };
}

function getConfiguredReviewMode(configuration: AiListingReviewConfiguration) {
  return configuration.mode === "recommend" ? "recommend" : "shadow";
}

export function parseModerationResponse(response: ModerationResponse) {
  const results = response.results;

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const categories = Array.from(
    new Set(
      results.flatMap((result) =>
        Object.entries(result.categories ?? {})
          .filter(([, matched]) => matched)
          .map(([category]) => category),
      ),
    ),
  ).sort();

  return {
    flagged: results.some((result) => result.flagged === true) || categories.length > 0,
    categories,
  };
}

async function writeAiReviewResult(input: {
  updateRequestId: string;
  aiReview: ChurchUpdateAiReview;
  auditAction: string;
  note: string;
}) {
  await updateChurchUpdateAiReviewInFirebase(input.updateRequestId, input.aiReview);
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: input.updateRequestId,
    action: input.auditAction,
    actorType: "system",
    after: { aiReview: input.aiReview },
    note: input.note,
  });
}

async function notifyMichaelWhenNeeded(input: {
  updateRequest: ChurchUpdateRequestRecord;
  existingReview: ChurchUpdateAiReviewRecord;
  church: Pick<ChurchRecord, "name">;
  aiReview: ChurchUpdateAiReview;
}) {
  if (
    input.aiReview.mode !== "recommend" ||
    !["needs_human", "error"].includes(input.aiReview.status) ||
    input.existingReview.notificationSentAt
  ) {
    return input.aiReview;
  }

  try {
    await sendAiListingReviewNeedsHumanNotification({
      church: input.church,
      updateRequest: input.updateRequest,
      categories: input.aiReview.categories ?? [],
    });

    return {
      ...input.aiReview,
      notificationSentAt: new Date().toISOString(),
    };
  } catch {
    // The listing stays pending even if the optional notification provider is
    // unavailable; the normal pending-update notification remains the backup.
    return input.aiReview;
  }
}

export async function processQueuedChurchUpdateAiReview(
  updateRequestId: string,
  dependencies: { fetchImpl?: typeof fetch } = {},
) {
  const claimedRequest = await claimQueuedChurchUpdateAiReviewInFirebase(updateRequestId);

  if (!claimedRequest) {
    return null;
  }

  const updateRequest = await getChurchUpdateRequestById(updateRequestId);

  if (!updateRequest || updateRequest.status !== "pending_review") {
    return null;
  }

  const configuration = getAiListingReviewConfiguration();
  const requestedAt = claimedRequest.requestedAt ?? new Date().toISOString();
  const reviewMode = getConfiguredReviewMode(configuration);

  if (!configuration.apiKey) {
    const aiReview: ChurchUpdateAiReview = {
      status: "not_configured",
      mode: reviewMode,
      requestedAt,
      reviewedAt: new Date().toISOString(),
      errorCode: "configuration",
    };
    await writeAiReviewResult({
      updateRequestId,
      aiReview,
      auditAction: "church_update_ai_review_not_configured",
      note: "AI listing review was not run because its server-side configuration is incomplete.",
    });
    return aiReview;
  }

  const church = await getChurchByIdFromFirebase(updateRequest.churchId);

  if (!church) {
    const aiReview: ChurchUpdateAiReview = {
      status: "error",
      mode: reviewMode,
      requestedAt,
      reviewedAt: new Date().toISOString(),
      errorCode: "provider",
    };
    const notifiedReview = await notifyMichaelWhenNeeded({
      updateRequest,
      existingReview: claimedRequest,
      church: { name: updateRequest.proposedChanges.name },
      aiReview,
    });
    await writeAiReviewResult({
      updateRequestId,
      aiReview: notifiedReview,
      auditAction: "church_update_ai_review_failed",
      note: "AI listing review could not load the current church record; the update remains pending human review.",
    });
    return notifiedReview;
  }

  const text = buildChangedPublicListingText(church, updateRequest.proposedChanges);
  const media = await loadChangedImagesForModeration({
    churchId: church.id,
    sources: getChangedImageSources(church, updateRequest.proposedChanges),
  });
  const moderationInput: ModerationInput[] = [
    ...(text ? [{ type: "text" as const, text }] : []),
    ...media.inputs,
  ];

  if (moderationInput.length === 0) {
    const aiReview: ChurchUpdateAiReview = {
      status: "needs_human",
      mode: reviewMode,
      requestedAt,
      reviewedAt: new Date().toISOString(),
      categories: ["no_reviewable_public_content"],
    };
    const notifiedReview = await notifyMichaelWhenNeeded({
      updateRequest,
      existingReview: claimedRequest,
      church,
      aiReview,
    });
    await writeAiReviewResult({
      updateRequestId,
      aiReview: notifiedReview,
      auditAction: "church_update_ai_review_needs_human",
      note: "AI listing review found no reviewable public content; the update remains pending human review.",
    });
    return notifiedReview;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await (dependencies.fetchImpl ?? fetch)(openAiModerationsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: moderationModel, input: moderationInput }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Moderation provider returned ${response.status}.`);
    }

    const parsed = parseModerationResponse((await response.json()) as ModerationResponse);

    if (!parsed) {
      const aiReview: ChurchUpdateAiReview = {
        status: "error",
        mode: reviewMode,
        requestedAt,
        reviewedAt: new Date().toISOString(),
        errorCode: "invalid_response",
      };
      const notifiedReview = await notifyMichaelWhenNeeded({
        updateRequest,
        existingReview: claimedRequest,
        church,
        aiReview,
      });
      await writeAiReviewResult({
        updateRequestId,
        aiReview: notifiedReview,
        auditAction: "church_update_ai_review_failed",
        note: "AI listing review returned an unusable response; the update remains pending human review.",
      });
      return notifiedReview;
    }

    const categories = [
      ...parsed.categories,
      ...(media.unavailable ? ["image_review_unavailable"] : []),
    ].sort();
    const aiReview: ChurchUpdateAiReview = {
      status: parsed.flagged || media.unavailable ? "needs_human" : "clear",
      mode: reviewMode,
      model: moderationModel,
      requestedAt,
      reviewedAt: new Date().toISOString(),
      categories,
    };
    const notifiedReview = await notifyMichaelWhenNeeded({
      updateRequest,
      existingReview: claimedRequest,
      church,
      aiReview,
    });

    await writeAiReviewResult({
      updateRequestId,
      aiReview: notifiedReview,
      auditAction:
        notifiedReview.status === "clear"
          ? "church_update_ai_review_clear"
          : "church_update_ai_review_needs_human",
      note:
        notifiedReview.status === "clear"
          ? "AI listing review found no policy signal. Human approval is still required."
          : "AI listing review requested human review. The update remains pending human approval.",
    });

    return notifiedReview;
  } catch {
    const aiReview: ChurchUpdateAiReview = {
      status: "error",
      mode: reviewMode,
      requestedAt,
      reviewedAt: new Date().toISOString(),
      errorCode: "provider",
    };
    const notifiedReview = await notifyMichaelWhenNeeded({
      updateRequest,
      existingReview: claimedRequest,
      church,
      aiReview,
    });
    await writeAiReviewResult({
      updateRequestId,
      aiReview: notifiedReview,
      auditAction: "church_update_ai_review_failed",
      note: "AI listing review was unavailable; the update remains pending human review.",
    });
    return notifiedReview;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Schedules a best-effort recommendation after the human review record exists.
 * It never changes the listing's pending_review status and a failed AI review
 * cannot prevent the existing manual review workflow from continuing.
 */
export async function scheduleChurchUpdateAiReview(
  updateRequest: Pick<ChurchUpdateRequestRecord, "id" | "churchId">,
) {
  const configuration = getAiListingReviewConfiguration();

  if (configuration.mode === "off") {
    return;
  }

  await queueChurchUpdateAiReviewInFirebase({
    updateRequestId: updateRequest.id,
    churchId: updateRequest.churchId,
    mode: configuration.mode,
  });

  after(async () => {
    try {
      await processQueuedChurchUpdateAiReview(updateRequest.id);
    } catch {
      // The request is already pending human review. Do not convert an
      // optional recommendation failure into a representative-facing error.
    }
  });
}
