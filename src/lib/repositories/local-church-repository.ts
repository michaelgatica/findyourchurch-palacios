import { getActiveLaunchCity, counties, states } from "@/lib/data/locations";
import { seedChurches } from "@/lib/data/churches";
import type { DirectoryFilterOptions } from "@/lib/types/directory";

export async function getPublishedChurchesLocally() {
  return seedChurches
    .filter((church) => church.status === "published")
    .sort((leftChurch, rightChurch) => leftChurch.name.localeCompare(rightChurch.name));
}

export async function getChurchBySlugLocally(churchSlug: string) {
  const publishedChurches = await getPublishedChurchesLocally();

  return publishedChurches.find((church) => church.slug === churchSlug) ?? null;
}

export async function getDirectoryFilterOptionsLocally(): Promise<DirectoryFilterOptions> {
  const publishedChurches = await getPublishedChurchesLocally();

  return {
    denominations: Array.from(
      new Set(publishedChurches.map((church) => church.denomination)),
    ).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue)),
    worshipStyles: Array.from(
      new Set(
        publishedChurches
          .map((church) => church.worshipStyle)
          .filter((worshipStyle): worshipStyle is string => Boolean(worshipStyle)),
      ),
    ).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue)),
  };
}

export async function getLaunchContextLocally() {
  const city = getActiveLaunchCity();
  const county = counties.find((region) => region.id === city.countyId) ?? null;
  const state = states.find((region) => region.id === city.stateId) ?? null;

  return {
    city,
    county,
    state,
  };
}
