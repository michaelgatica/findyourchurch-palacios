import { redirect } from "next/navigation";

import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import {
  activateInvitedRepresentative,
  getRepresentativeForChurchUser,
  listChurchRepresentativesForChurch,
  listChurchRepresentativesForUser,
  listInvitedRepresentativesByEmail,
} from "@/lib/repositories/firebase-representative-repository";
import { getUserById, upsertUserProfile } from "@/lib/repositories/firebase-user-repository";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import type {
  AppUserRecord,
  AuthenticatedAppUser,
  ChurchRecord,
  ChurchRepresentativeRecord,
} from "@/lib/types/directory";

import { touchChurchListingRepresentativeActivity } from "@/lib/services/listing-verification-service";

function sortRepresentativesByPriority(
  representatives: ChurchRepresentativeRecord[],
) {
  return [...representatives].sort((leftRepresentative, rightRepresentative) => {
    if (
      leftRepresentative.permissionRole === "primary_owner" &&
      rightRepresentative.permissionRole !== "primary_owner"
    ) {
      return -1;
    }

    if (
      leftRepresentative.permissionRole !== "primary_owner" &&
      rightRepresentative.permissionRole === "primary_owner"
    ) {
      return 1;
    }

    return rightRepresentative.updatedAt.localeCompare(leftRepresentative.updatedAt);
  });
}

function isRepresentativeActive(record: ChurchRepresentativeRecord) {
  return (
    record.status === "active" &&
    (record.permissionRole === "primary_owner" || record.permissionRole === "editor")
  );
}

async function ensureUserProfile(
  authenticatedUser: AuthenticatedAppUser,
): Promise<AppUserRecord> {
  if (authenticatedUser.profile) {
    return authenticatedUser.profile;
  }

  return upsertUserProfile({
    firebaseUid: authenticatedUser.firebaseUid,
    email: authenticatedUser.email ?? "",
    name:
      authenticatedUser.email?.split("@")[0] ??
      "Find Your Church User",
  });
}

export async function syncRepresentativeUserRole(userId: string) {
  const userProfile = await getUserById(userId);

  if (!userProfile) {
    return null;
  }

  if (userProfile.role === "admin") {
    return userProfile;
  }

  const representatives = await listChurchRepresentativesForUser(userId);
  const hasActivePrimary = representatives.some(
    (representative) =>
      representative.status === "active" &&
      representative.permissionRole === "primary_owner",
  );
  const hasActiveEditor = representatives.some(
    (representative) =>
      representative.status === "active" &&
      representative.permissionRole === "editor",
  );
  const nextRole = hasActivePrimary
    ? "church_primary"
    : hasActiveEditor
      ? "church_editor"
      : "pending_user";

  if (userProfile.role === nextRole) {
    return userProfile;
  }

  return upsertUserProfile({
    firebaseUid: userProfile.id,
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone,
    role: nextRole,
  });
}

export async function activateMatchingRepresentativeInvites(input: {
  profile: AppUserRecord;
}) {
  if (!input.profile.email) {
    return [];
  }

  const invitedRepresentatives = await listInvitedRepresentativesByEmail(input.profile.email);
  const activatedRepresentatives: ChurchRepresentativeRecord[] = [];

  for (const invitedRepresentative of invitedRepresentatives) {
    if (
      invitedRepresentative.userId &&
      invitedRepresentative.userId !== input.profile.id
    ) {
      continue;
    }

    const activatedRepresentative = await activateInvitedRepresentative(
      invitedRepresentative.id,
      {
        userId: input.profile.id,
        name: input.profile.name,
        phone: input.profile.phone,
      },
    );

    activatedRepresentatives.push(activatedRepresentative);
    await createAuditLogInFirebase({
      entityType: "churchRepresentative",
      entityId: activatedRepresentative.id,
      action:
        activatedRepresentative.permissionRole === "editor"
          ? "editor_activated"
          : "representative_activated",
      actorId: input.profile.id,
      actorType: "church_rep",
      before: invitedRepresentative,
      after: activatedRepresentative,
      note: "Representative access activated after authentication.",
    });
  }

  if (activatedRepresentatives.length > 0) {
    await syncRepresentativeUserRole(input.profile.id);
  }

  return activatedRepresentatives;
}

export interface RepresentativePortalContext {
  authenticatedUser: AuthenticatedAppUser;
  profile: AppUserRecord;
  representative: ChurchRepresentativeRecord | null;
  church: ChurchRecord | null;
  allRepresentatives: ChurchRepresentativeRecord[];
  churchTeam: ChurchRepresentativeRecord[];
}

export async function getRepresentativePortalContext(): Promise<RepresentativePortalContext | null> {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser) {
    return null;
  }

  const profile = await ensureUserProfile(authenticatedUser);

  await activateMatchingRepresentativeInvites({
    profile,
  });

  const allRepresentatives = sortRepresentativesByPriority(
    (await listChurchRepresentativesForUser(profile.id)).filter(isRepresentativeActive),
  );
  const representative = allRepresentatives[0] ?? null;
  const resolvedChurch = representative
    ? await getChurchByIdFromFirebase(representative.churchId)
    : null;
  const touchedChurch = resolvedChurch
    ? await touchChurchListingRepresentativeActivity({
        churchId: resolvedChurch.id,
      })
    : null;
  const church = touchedChurch?.church ?? resolvedChurch;
  const churchTeam = church
    ? await listChurchRepresentativesForChurch(church.id)
    : [];
  const syncedProfile = (await syncRepresentativeUserRole(profile.id)) ?? profile;

  return {
    authenticatedUser: {
      ...authenticatedUser,
      profile: syncedProfile,
    },
    profile: syncedProfile,
    representative: representative && church ? representative : null,
    church,
    allRepresentatives,
    churchTeam,
  };
}

export async function requireRepresentativePortalSession(redirectPath: string) {
  const context = await getRepresentativePortalContext();

  if (!context) {
    redirect(`/portal/login?next=${encodeURIComponent(redirectPath)}`);
  }

  return context;
}

export async function requireRepresentativeChurchAccess(input: {
  userId: string;
  churchId: string;
  requirePrimary?: boolean;
}) {
  const profile = await getUserById(input.userId);

  if (!profile) {
    throw new Error("The signed-in user profile could not be found.");
  }

  const representative = await getRepresentativeForChurchUser(
    input.churchId,
    input.userId,
  );

  if (!representative || !isRepresentativeActive(representative)) {
    throw new Error("You do not have access to manage this church listing.");
  }

  if (
    input.requirePrimary &&
    representative.permissionRole !== "primary_owner"
  ) {
    throw new Error("Only the primary owner can perform this action.");
  }

  const church = await getChurchByIdFromFirebase(input.churchId);

  if (!church) {
    throw new Error("The church listing could not be found.");
  }

  return {
    profile,
    representative,
    church,
  };
}
