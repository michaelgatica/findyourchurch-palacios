import {
  getDirectoryFilterOptionsFromFirebase,
  getChurchBySlugFromFirebase,
  getPublishedChurchesFromFirebase,
} from "@/lib/repositories/firebase-church-repository";
import {
  getDirectoryFilterOptionsLocally,
  getChurchBySlugLocally,
  getLaunchContextLocally,
  getPublishedChurchesLocally,
} from "@/lib/repositories/local-church-repository";
import { getRepositoryMode } from "@/lib/repositories/repository-mode";

function canUseLocalSeedFallback() {
  return process.env.NODE_ENV !== "production";
}

export async function getPublishedChurches() {
  if (getRepositoryMode() === "firebase") {
    const churches = await getPublishedChurchesFromFirebase();

    if (churches.length > 0 || !canUseLocalSeedFallback()) {
      return churches;
    }
  }

  if (!canUseLocalSeedFallback()) {
    return [];
  }

  return getPublishedChurchesLocally();
}

export async function getChurchBySlug(churchSlug: string) {
  if (getRepositoryMode() === "firebase") {
    const church = await getChurchBySlugFromFirebase(churchSlug);

    if (church || !canUseLocalSeedFallback()) {
      return church;
    }
  }

  if (!canUseLocalSeedFallback()) {
    return null;
  }

  return getChurchBySlugLocally(churchSlug);
}

export async function getDirectoryFilterOptions() {
  if (getRepositoryMode() === "firebase") {
    const filterOptions = await getDirectoryFilterOptionsFromFirebase();

    if (
      filterOptions.denominations.length > 0 ||
      filterOptions.worshipStyles.length > 0 ||
      !canUseLocalSeedFallback()
    ) {
      return filterOptions;
    }
  }

  if (!canUseLocalSeedFallback()) {
    return {
      denominations: [],
      worshipStyles: [],
    };
  }

  return getDirectoryFilterOptionsLocally();
}

export async function getLaunchContext() {
  return getLaunchContextLocally();
}
