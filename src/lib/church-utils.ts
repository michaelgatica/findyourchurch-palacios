import type { ChurchRecord, DirectoryFilters, StructuredAddress } from "@/lib/types/directory";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

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

export function getServiceTimeLabel(serviceTime: ChurchRecord["serviceTimes"][number] | string | null | undefined) {
  if (!serviceTime) {
    return "";
  }

  if (typeof serviceTime === "string") {
    return serviceTime;
  }

  return serviceTime.label;
}

export function getPrimaryServiceTimeLabel(church: ChurchRecord) {
  return getServiceTimeLabel(getPrimaryServiceTime(church));
}

export function buildDirectionsUrl(address: StructuredAddress) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(address))}`;
}

export function getChurchCoordinates(church: ChurchRecord): GeoPoint | null {
  const { latitude, longitude } = church.address;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return { latitude, longitude };
}

export function calculateDistanceMiles(from: GeoPoint, to: GeoPoint) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const haversineDistance =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversineDistance));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
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
    church.serviceTimes.map(getServiceTimeLabel).join(" "),
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
