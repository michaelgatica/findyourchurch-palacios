"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { ChurchCard } from "@/components/church-card";
import { siteConfig } from "@/lib/config/site";
import {
  calculateDistanceMiles,
  filterChurches,
  getChurchCoordinates,
  type GeoPoint,
} from "@/lib/church-utils";
import {
  emptyDirectoryFilters,
  type ChurchRecord,
  type DirectoryFilters,
} from "@/lib/types/directory";

const DirectoryMap = dynamic(
  () => import("@/components/directory-map").then((module) => module.DirectoryMap),
  {
    ssr: false,
    loading: () => (
      <div className="directory-map__loading directory-map__loading--shimmer" aria-busy="true" aria-label="Loading church map" role="status" />
    ),
  },
);

const radiusOptions = [5, 10, 25, 50];

interface DirectoryBrowserProps {
  churches: ChurchRecord[];
  filterOptions: {
    denominations: string[];
    worshipStyles: string[];
  };
}

type LocationSearchStatus = "idle" | "searching" | "locating";

export function DirectoryBrowser({ churches, filterOptions }: DirectoryBrowserProps) {
  const [filters, setFilters] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationRadiusMiles, setLocationRadiusMiles] = useState(10);
  const [referencePoint, setReferencePoint] = useState<GeoPoint | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationSearchStatus>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const deferredKeyword = useDeferredValue(filters.keyword);
  const keywordFilteredChurches = filterChurches(churches, {
    ...filters,
    keyword: deferredKeyword,
  });

  const visibleChurches = keywordFilteredChurches
    .map((church) => {
      const coordinates = getChurchCoordinates(church);
      const distanceMiles =
        referencePoint && coordinates
          ? calculateDistanceMiles(referencePoint, coordinates)
          : null;

      return {
        church,
        distanceMiles,
      };
    })
    .filter((entry) => {
      if (!referencePoint) {
        return true;
      }

      return (
        typeof entry.distanceMiles === "number" &&
        entry.distanceMiles <= locationRadiusMiles
      );
    })
    .sort((leftEntry, rightEntry) => {
      if (!referencePoint) {
        return leftEntry.church.name.localeCompare(rightEntry.church.name);
      }

      if (typeof leftEntry.distanceMiles === "number" && typeof rightEntry.distanceMiles === "number") {
        return leftEntry.distanceMiles - rightEntry.distanceMiles;
      }

      if (typeof leftEntry.distanceMiles === "number") {
        return -1;
      }

      if (typeof rightEntry.distanceMiles === "number") {
        return 1;
      }

      return leftEntry.church.name.localeCompare(rightEntry.church.name);
    });

  const visibleChurchRecords = visibleChurches.map((entry) => entry.church);
  const mapChurches = visibleChurchRecords.filter((church) => Boolean(getChurchCoordinates(church)));
  const hasPublishedChurches = churches.length > 0;

  useEffect(() => {
    if (selectedChurchId && !visibleChurchRecords.some((church) => church.id === selectedChurchId)) {
      setSelectedChurchId(null);
    }
  }, [selectedChurchId, visibleChurchRecords]);

  useEffect(() => {
    if (!referencePoint) {
      return;
    }

    if (locationQuery === "Current location") {
      setLocationMessage(`Showing churches within ${locationRadiusMiles} miles of your location.`);
      return;
    }

    setLocationMessage(`Showing churches within ${locationRadiusMiles} miles of your search.`);
  }, [locationQuery, locationRadiusMiles, referencePoint]);

  function updateFilter<FieldName extends keyof DirectoryFilters>(
    fieldName: FieldName,
    value: DirectoryFilters[FieldName],
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  }

  function resetFilters() {
    setFilters(emptyDirectoryFilters);
    setLocationQuery("");
    setLocationRadiusMiles(10);
    setReferencePoint(null);
    setLocationStatus("idle");
    setLocationMessage("");
    setSelectedChurchId(null);
  }

  async function runLocationSearch() {
    const trimmedLocationQuery = locationQuery.trim();

    if (!trimmedLocationQuery) {
      setReferencePoint(null);
      setLocationMessage("");
      return;
    }

    setLocationStatus("searching");
    setLocationMessage("");

    try {
      const response = await fetch(
        `/api/location-search?query=${encodeURIComponent(trimmedLocationQuery)}`,
      );
      const payload = (await response.json()) as {
        error?: string;
        found?: boolean;
        coordinates?: GeoPoint | null;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "We could not search that location right now.");
      }

      if (!payload.found || !payload.coordinates) {
        setReferencePoint(null);
        setLocationMessage(
          `We could not place that location on the map. Try a ${siteConfig.launchCity} address, city name, or ZIP code.`,
        );
        return;
      }

      setReferencePoint(payload.coordinates);
      setLocationMessage(`Showing churches within ${locationRadiusMiles} miles of your search.`);
    } catch (error) {
      setReferencePoint(null);
      setLocationMessage(
        error instanceof Error
          ? error.message
          : "We could not search that location right now.",
      );
    } finally {
      setLocationStatus("idle");
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Location services are not available in this browser.");
      return;
    }

    setLocationStatus("locating");
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReferencePoint({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationQuery("Current location");
        setLocationMessage(`Showing churches within ${locationRadiusMiles} miles of your location.`);
        setLocationStatus("idle");
      },
      () => {
        setLocationMessage(
          "We could not access your location. You can still search by address or ZIP code.",
        );
        setLocationStatus("idle");
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
      },
    );
  }

  return (
    <div className="directory-layout">
      <div className="directory-search-stack">
        <div className="panel directory-search-panel">
          <div className="directory-search-panel__header">
            <div>
              <p className="eyebrow eyebrow--gold">Search Churches</p>
              <h2 className="directory-search-panel__title">
                <span>Search by ministry,</span>
                <span>then explore the map</span>
              </h2>
              <p className="supporting-text">
                Search by church name, pastor, ministry, worship style, or keyword, then search near
                a {siteConfig.launchCity} address, ZIP code, or your current location.
              </p>
            </div>
            <span className="directory-results__count">
              {visibleChurchRecords.length}{" "}
              {visibleChurchRecords.length === 1 ? "church" : "churches"} found
            </span>
          </div>

          <label className="field field--full directory-search-panel__search-field">
            <span className="field__label">Search by keyword</span>
            <input
              type="search"
              name="keyword"
              value={filters.keyword}
              onChange={(event) => updateFilter("keyword", event.target.value)}
              placeholder="Search by church name, pastor, ministry, worship style, or keyword"
            />
          </label>

          <div className="directory-location-grid">
            <label className="field directory-location-grid__search">
              <span className="field__label">Search near a location</span>
              <input
                type="search"
                name="locationQuery"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                placeholder={`${siteConfig.launchCity} address, city, or ZIP code`}
              />
            </label>

            <label className="field directory-location-grid__radius">
              <span className="field__label">Distance</span>
              <select
                name="locationRadiusMiles"
                value={locationRadiusMiles}
                onChange={(event) => setLocationRadiusMiles(Number(event.target.value))}
              >
                {radiusOptions.map((radiusOption) => (
                  <option key={radiusOption} value={radiusOption}>
                    Within {radiusOption} miles
                  </option>
                ))}
              </select>
            </label>

            <div className="directory-location-grid__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={runLocationSearch}
                disabled={locationStatus !== "idle"}
              >
                {locationStatus === "searching" ? "Searching..." : "Search area"}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={useCurrentLocation}
                disabled={locationStatus !== "idle"}
              >
                {locationStatus === "locating" ? "Locating..." : "Use my location"}
              </button>
            </div>
          </div>

          {locationMessage ? (
            <p className="supporting-text directory-search-panel__location-message">
              {locationMessage}
            </p>
          ) : null}

          <div className="directory-filter-grid">
            <label className="field">
              <span className="field__label">Denomination / tradition</span>
              <select
                name="denomination"
                value={filters.denomination}
                onChange={(event) => updateFilter("denomination", event.target.value)}
              >
                <option value="">All traditions</option>
                {filterOptions.denominations.map((denomination) => (
                  <option key={denomination} value={denomination}>
                    {denomination}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Worship style</span>
              <select
                name="worshipStyle"
                value={filters.worshipStyle}
                onChange={(event) => updateFilter("worshipStyle", event.target.value)}
              >
                <option value="">All worship styles</option>
                {filterOptions.worshipStyles.map((worshipStyle) => (
                  <option key={worshipStyle} value={worshipStyle}>
                    {worshipStyle}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="directory-toggle-grid">
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={filters.childrenMinistry}
                onChange={(event) => updateFilter("childrenMinistry", event.target.checked)}
              />
              <span>Children&apos;s ministry</span>
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={filters.youthMinistry}
                onChange={(event) => updateFilter("youthMinistry", event.target.checked)}
              />
              <span>Youth ministry</span>
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={filters.nurseryCare}
                onChange={(event) => updateFilter("nurseryCare", event.target.checked)}
              />
              <span>Nursery care</span>
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={filters.spanishService}
                onChange={(event) => updateFilter("spanishService", event.target.checked)}
              />
              <span>Spanish service</span>
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={filters.livestream}
                onChange={(event) => updateFilter("livestream", event.target.checked)}
              />
              <span>Livestream</span>
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={filters.wheelchairAccessible}
                onChange={(event) => updateFilter("wheelchairAccessible", event.target.checked)}
              />
              <span>Wheelchair accessible</span>
            </label>
          </div>

          <div className="directory-search-panel__actions">
            <button type="button" className="button button--ghost" onClick={resetFilters}>
              Clear filters
            </button>
            <p className="supporting-text">
              Results update as you type, and map search narrows churches by distance.
            </p>
          </div>
        </div>

        <div className="panel directory-map-panel">
          <div className="directory-map-panel__header">
            <div>
              <h3>Map results</h3>
              <p className="supporting-text">
                View nearby churches on the map, then open a listing or directions from a marker.
              </p>
            </div>
          </div>

          {mapChurches.length > 0 ? (
            <DirectoryMap
              churches={mapChurches}
              referencePoint={referencePoint}
              selectedChurchId={selectedChurchId}
              onSelectChurch={setSelectedChurchId}
            />
          ) : (
            <div className="directory-map__empty">
              <p>
                We could not place these church listings on the map yet. The directory list below
                is still available while location details are completed.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="directory-results">
        {visibleChurchRecords.length === 0 ? (
          <div className="empty-state">
            <h3>
              {hasPublishedChurches
                ? "No churches matched your search"
                : "No published churches are listed yet"}
            </h3>
            <p>
              {hasPublishedChurches
                ? referencePoint
                  ? "Try widening the map radius, clearing the location search, or searching with a simpler keyword."
                  : "Try clearing one or more filters, or search with a simpler keyword such as a church name, denomination, city, or service time."
                : "Churches can still submit their information now so the directory can continue to grow."}
            </p>
            <div className="button-row">
              {hasPublishedChurches ? (
                <button type="button" className="button button--secondary" onClick={resetFilters}>
                  Clear all filters
                </button>
              ) : null}
              <Link href="/submit" className="button button--ghost">
                Submit a church listing
              </Link>
            </div>
          </div>
        ) : (
          <div className="directory-list">
            {visibleChurches.map(({ church, distanceMiles }) => (
              <ChurchCard
                key={church.id}
                church={church}
                distanceMiles={distanceMiles}
                isHighlighted={selectedChurchId === church.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
