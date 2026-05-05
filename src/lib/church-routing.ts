import { getCityById, states } from "@/lib/data/locations";

type ChurchRouteTarget = {
  slug: string;
  customShareSlug?: string | null;
  cityId?: string | null;
  address?: {
    city: string;
    stateCode: string;
  };
  city?: string;
  state?: string;
};

const reservedChurchShareSlugs = new Set(
  [
    "",
    "account",
    "about",
    "admin",
    "api",
    "churches",
    "contact",
    "favicon.ico",
    "icon.png",
    "listing-acknowledge",
    "listing-guidelines",
    "portal",
    "privacy",
    "robots.txt",
    "sitemap.xml",
    "submit",
    "terms",
  ].concat(
    states.flatMap((state) => [state.code.toLowerCase(), state.slug.toLowerCase()]),
  ),
);

function toPathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveRouteStateCode(target: ChurchRouteTarget) {
  return (target.address?.stateCode ?? target.state ?? "").trim().toLowerCase();
}

function resolveRouteCitySlug(target: ChurchRouteTarget) {
  const cityFromLookup = target.cityId ? getCityById(target.cityId)?.slug : null;
  const cityValue = cityFromLookup ?? target.address?.city ?? target.city ?? "";
  return toPathSegment(cityValue);
}

export function normalizeChurchShareSlug(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = toPathSegment(value);
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function isReservedChurchShareSlug(value: string | null | undefined) {
  const normalizedValue = normalizeChurchShareSlug(value);

  if (!normalizedValue) {
    return false;
  }

  return reservedChurchShareSlugs.has(normalizedValue);
}

export function buildChurchProfilePath(target: ChurchRouteTarget | string) {
  if (typeof target === "string") {
    return `/churches/${target}`;
  }

  const stateCode = resolveRouteStateCode(target);
  const citySlug = resolveRouteCitySlug(target);

  if (!stateCode || !citySlug) {
    return `/churches/${target.slug}`;
  }

  return `/${stateCode}/${citySlug}/${target.slug}`;
}

export function buildChurchClaimPath(target: ChurchRouteTarget | string) {
  return `${buildChurchProfilePath(target)}/claim`;
}

export function buildChurchSharePath(customShareSlug: string | null | undefined) {
  const normalizedValue = normalizeChurchShareSlug(customShareSlug);

  if (!normalizedValue || isReservedChurchShareSlug(normalizedValue)) {
    return null;
  }

  return `/${normalizedValue}`;
}
