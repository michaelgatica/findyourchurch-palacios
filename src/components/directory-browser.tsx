"use client";

import Link from "next/link";
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

  const hasPublishedChurches = churches.length > 0;

  return (
    <div className="directory-layout">
      <div className="panel directory-search-panel">
        <div className="directory-search-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Search Churches</p>
            <h2 className="directory-search-panel__title">
              <span>Find the right church</span>
              <span>for your family or visit</span>
            </h2>
            <p className="supporting-text">
              Search by church name, pastor, ministry, worship style, or keyword, then narrow the
              list with filters.
            </p>
          </div>
          <span className="directory-results__count">
            {filteredChurches.length} {filteredChurches.length === 1 ? "church" : "churches"}{" "}
            found
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
            <span>Children&apos;s</span>
          </label>

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={filters.youthMinistry}
              onChange={(event) => updateFilter("youthMinistry", event.target.checked)}
            />
            <span>Youth</span>
          </label>

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={filters.nurseryCare}
              onChange={(event) => updateFilter("nurseryCare", event.target.checked)}
            />
            <span>Nursery</span>
          </label>

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={filters.spanishService}
              onChange={(event) => updateFilter("spanishService", event.target.checked)}
            />
            <span>Spanish</span>
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
            <span>Accessible</span>
          </label>
        </div>

        <div className="directory-search-panel__actions">
          <button type="button" className="button button--ghost" onClick={resetFilters}>
            Clear filters
          </button>
          <p className="supporting-text">Results update as you type and select filters.</p>
        </div>
      </div>

      <div className="directory-results">
        {filteredChurches.length === 0 ? (
          <div className="empty-state">
            <h3>
              {hasPublishedChurches
                ? "No churches matched your search"
                : "No published churches are listed yet"}
            </h3>
            <p>
              {hasPublishedChurches
                ? "Try clearing one or more filters, or search with a simpler keyword such as a church name, denomination, city, or service time."
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
            {filteredChurches.map((church) => (
              <ChurchCard key={church.id} church={church} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
