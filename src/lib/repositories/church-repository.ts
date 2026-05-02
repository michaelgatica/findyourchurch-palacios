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

export async function getPublishedChurches() {
  if (getRepositoryMode() === "firebase") {
    const churches = await getPublishedChurchesFromFirebase();

    if (churches.length > 0) {
      return churches;
    }
  }

  return getPublishedChurchesLocally();
}

export async function getChurchBySlug(churchSlug: string) {
  if (getRepositoryMode() === "firebase") {
    const church = await getChurchBySlugFromFirebase(churchSlug);

    if (church) {
      return church;
    }
  }

  return getChurchBySlugLocally(churchSlug);
}

export async function getDirectoryFilterOptions() {
  if (getRepositoryMode() === "firebase") {
    const filterOptions = await getDirectoryFilterOptionsFromFirebase();

    if (filterOptions.denominations.length > 0 || filterOptions.worshipStyles.length > 0) {
      return filterOptions;
    }
  }

  return getDirectoryFilterOptionsLocally();
}

export async function getLaunchContext() {
  return getLaunchContextLocally();
}
