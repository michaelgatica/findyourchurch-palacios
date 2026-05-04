import { formatAddress, type GeoPoint } from "@/lib/church-utils";
import type { ChurchRecord } from "@/lib/types/directory";

const knownChurchCoordinatesBySlug: Record<string, GeoPoint> = {
  "grace-harbor-fellowship": {
    latitude: 28.7054,
    longitude: -96.2188,
  },
  "st-mark-by-the-bay": {
    latitude: 28.7066,
    longitude: -96.2146,
  },
  "iglesia-esperanza-palacios": {
    latitude: 28.7079,
    longitude: -96.2132,
  },
  "annual-verification-test-church": {
    latitude: 28.7092,
    longitude: -96.2174,
  },
  "annual-verification-test-church-b": {
    latitude: 28.7099,
    longitude: -96.2161,
  },
};

const geocodeCache = new Map<string, Promise<GeoPoint | null> | GeoPoint | null>();

function normalizeLocationQuery(value: string) {
  return value.trim().toLowerCase();
}

async function fetchGeocodedCoordinates(query: string) {
  const normalizedQuery = normalizeLocationQuery(query);

  if (!normalizedQuery) {
    return null;
  }

  const cachedCoordinates = geocodeCache.get(normalizedQuery);

  if (cachedCoordinates) {
    return cachedCoordinates instanceof Promise
      ? cachedCoordinates
      : Promise.resolve(cachedCoordinates);
  }

  const pendingCoordinates = (async () => {
    try {
      const requestUrl = new URL("https://nominatim.openstreetmap.org/search");
      requestUrl.searchParams.set("q", query);
      requestUrl.searchParams.set("format", "jsonv2");
      requestUrl.searchParams.set("limit", "1");
      requestUrl.searchParams.set("countrycodes", "us");

      const response = await fetch(requestUrl, {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "FindYourChurchPalacios/1.0 (support@findyourchurchpalacios.org)",
        },
        next: {
          revalidate: 60 * 60 * 24,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as Array<{
        lat?: string;
        lon?: string;
      }>;
      const match = payload[0];

      if (!match?.lat || !match.lon) {
        return null;
      }

      const latitude = Number(match.lat);
      const longitude = Number(match.lon);

      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return null;
      }

      return {
        latitude,
        longitude,
      } satisfies GeoPoint;
    } catch (error) {
      console.warn(`Unable to geocode location query "${query}".`, error);
      return null;
    }
  })();

  geocodeCache.set(normalizedQuery, pendingCoordinates);
  const resolvedCoordinates = await pendingCoordinates;
  geocodeCache.set(normalizedQuery, resolvedCoordinates);

  return resolvedCoordinates;
}

export async function geocodeLocationSearchQuery(locationQuery: string) {
  return fetchGeocodedCoordinates(locationQuery);
}

export async function resolveChurchMapCoordinates(church: ChurchRecord) {
  if (
    typeof church.address.latitude === "number" &&
    typeof church.address.longitude === "number"
  ) {
    return church;
  }

  const knownCoordinates = knownChurchCoordinatesBySlug[church.slug];
  const geocodedCoordinates =
    knownCoordinates ??
    (await fetchGeocodedCoordinates(`${formatAddress(church.address)}, United States`));

  if (!geocodedCoordinates) {
    return church;
  }

  return {
    ...church,
    address: {
      ...church.address,
      latitude: geocodedCoordinates.latitude,
      longitude: geocodedCoordinates.longitude,
    },
  };
}

export async function resolveChurchesForDirectoryMap(churches: ChurchRecord[]) {
  return Promise.all(churches.map((church) => resolveChurchMapCoordinates(church)));
}
