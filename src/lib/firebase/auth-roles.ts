import type {
  AppUserRecord,
  AppUserRole,
  ChurchRepresentativePermissionRole,
} from "@/lib/types/directory";

export function isAdminRole(role?: AppUserRole | null) {
  return role === "admin";
}

export function isChurchPrimaryRole(role?: AppUserRole | null) {
  return role === "church_primary";
}

export function isChurchEditorRole(role?: AppUserRole | null) {
  return role === "church_editor";
}

export function userCanManageChurch(role?: AppUserRole | null) {
  return isAdminRole(role) || isChurchPrimaryRole(role) || isChurchEditorRole(role);
}

export function isAdminUserProfile(userProfile: AppUserRecord | null) {
  return isAdminRole(userProfile?.role ?? null);
}

export function isRepresentativePermissionRolePrimary(
  permissionRole?: ChurchRepresentativePermissionRole | null,
) {
  return permissionRole === "primary_owner";
}
