"use client";

import { useDeferredValue, useState } from "react";

import { ChurchCard } from "@/components/church-card";
import { filterChurches } from "@/lib/church-utils";
import {
  emptyDirectoryFilters,
  type ChurchRecord,
  type DirectoryFilters,
} from "@/lib/types/directory";

interface DirectoryBrowserProps {
  churches: ChurchRecord[];
  filterOptions: {
    denominations: string[];
    worshipStyles: string[];
  };
}

export function DirectoryBrowser({ churches, filterOptions }: DirectoryBrowserProps) {
  const [filters, setFilters] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const deferredKeyword = useDeferredValue(filters.keyword);
  const filteredChurches = filterChurches(churches, {
    ...filters,
    keyword: deferredKeyword,
  });

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
  }

  return (
    <div className="directory-layout">
      <aside className="directory-sidebar">
        <div className="panel">
          <h2>Search and filter</h2>
          <p>
            Search by church name, description, denomination, clergy name, ministries, worship
            style, languages, or city.
          </p>

          <div className="field-stack">
            <label className="field">
              <span className="field__label">Keyword search</span>
              <input
                type="search"
                name="keyword"
                value={filters.keyword}
                onChange={(event) => updateFilter("keyword", event.target.value)}
                placeholder="Search churches near you"
              />
            </label>

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

          <div className="toggle-grid">
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

          <button type="button" className="button button--ghost" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </aside>

      <div className="directory-results">
        <div className="directory-results__header">
          <div>
            <p className="eyebrow eyebrow--gold">Church Directory</p>
            <h2>Explore local churches in the Palacios area</h2>
          </div>
          <p className="directory-results__count">
            {filteredChurches.length} {filteredChurches.length === 1 ? "church" : "churches"}{" "}
            found
          </p>
        </div>

        {filteredChurches.length === 0 ? (
          <div className="empty-state">
            <h3>No churches matched your search</h3>
            <p>
              Try clearing one or more filters, or search with a simpler keyword such as a church
              name, denomination, or city.
            </p>
            <button type="button" className="button button--secondary" onClick={resetFilters}>
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="church-grid">
            {filteredChurches.map((church) => (
              <ChurchCard key={church.id} church={church} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
