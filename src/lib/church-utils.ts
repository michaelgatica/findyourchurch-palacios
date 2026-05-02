import type { ChurchRecord, DirectoryFilters, StructuredAddress } from "@/lib/types/directory";

export function formatAddress(address: StructuredAddress) {
  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.stateCode} ${address.postalCode}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function getPrimaryServiceTime(church: ChurchRecord) {
  return church.serviceTimes.find((serviceTime) => serviceTime.isPrimary) ?? church.serviceTimes[0];
}

export function buildDirectionsUrl(address: StructuredAddress) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(address))}`;
}

export function getChurchInitials(churchName: string) {
  return churchName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getChurchCardTags(church: ChurchRecord) {
  const tags = [...church.ministryTags.map((tag) => tag.label)];

  if (church.features.childrenMinistry) {
    tags.push("Children's Ministry");
  }

  if (church.features.youthMinistry) {
    tags.push("Youth Ministry");
  }

  if (church.features.spanishService) {
    tags.push("Spanish Service");
  }

  if (church.features.livestream) {
    tags.push("Livestream");
  }

  if (church.features.wheelchairAccessible) {
    tags.push("Accessible");
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function createSearchableText(church: ChurchRecord) {
  return [
    church.name,
    church.description,
    church.denomination,
    church.specificAffiliation,
    church.primaryClergyName,
    church.additionalLeaders.join(" "),
    church.ministryTags.map((tag) => tag.label).join(" "),
    church.worshipStyle,
    church.languages.join(" "),
    church.address.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterChurches(churches: ChurchRecord[], filters: DirectoryFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  return churches.filter((church) => {
    if (keyword && !createSearchableText(church).includes(keyword)) {
      return false;
    }

    if (filters.denomination && church.denomination !== filters.denomination) {
      return false;
    }

    if (filters.worshipStyle && church.worshipStyle !== filters.worshipStyle) {
      return false;
    }

    if (filters.childrenMinistry && !church.features.childrenMinistry) {
      return false;
    }

    if (filters.youthMinistry && !church.features.youthMinistry) {
      return false;
    }

    if (filters.nurseryCare && !church.features.nurseryCare) {
      return false;
    }

    if (filters.spanishService && !church.features.spanishService) {
      return false;
    }

    if (filters.livestream && !church.features.livestream) {
      return false;
    }

    if (filters.wheelchairAccessible && !church.features.wheelchairAccessible) {
      return false;
    }

    return true;
  });
}
