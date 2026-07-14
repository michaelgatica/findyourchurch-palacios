"use client";

import { useMemo, useState } from "react";

import { EventCard } from "@/components/event-card";
import {
  audienceAndMinistryOptions,
  primaryEventTypeOptions,
} from "@/lib/data/event-taxonomy";
import { filterEvents } from "@/lib/event-utils";
import { emptyEventFilters, type EventFilters, type EventRecord } from "@/lib/types/events";

interface EventBrowserProps {
  events: EventRecord[];
}

function getUniqueValues(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (leftValue, rightValue) => leftValue.localeCompare(rightValue),
  );
}

export function EventBrowser({ events }: EventBrowserProps) {
  const [filters, setFilters] = useState<EventFilters>(emptyEventFilters);
  const filteredEvents = filterEvents(events, filters);
  const churchOptions = useMemo(
    () =>
      Array.from(
        new Map(events.map((event) => [event.churchId, event.churchName])).entries(),
      ).sort(([, leftName], [, rightName]) => leftName.localeCompare(rightName)),
    [events],
  );
  const cityOptions = useMemo(
    () => getUniqueValues(events.map((event) => event.address?.city)),
    [events],
  );
  const languageOptions = useMemo(
    () => getUniqueValues(events.flatMap((event) => event.languages)),
    [events],
  );

  function updateFilter<FieldName extends keyof EventFilters>(
    fieldName: FieldName,
    value: EventFilters[FieldName],
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  }

  return (
    <div className="events-layout">
      <aside className="panel events-filter-panel">
        <div className="events-filter-panel__header">
          <p className="eyebrow eyebrow--gold">Find Events</p>
          <h2>Search the community calendar</h2>
          <span className="directory-results__count">
            {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
          </span>
        </div>

        <label className="field">
          <span className="field__label">Keyword</span>
          <input
            type="search"
            value={filters.keyword}
            onChange={(event) => updateFilter("keyword", event.target.value)}
            placeholder="Search by title, church, city, ministry, or keyword"
          />
        </label>

        <label className="field">
          <span className="field__label">Church</span>
          <select
            value={filters.churchId}
            onChange={(event) => updateFilter("churchId", event.target.value)}
          >
            <option value="">All churches</option>
            {churchOptions.map(([churchId, churchName]) => (
              <option key={churchId} value={churchId}>
                {churchName}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">City</span>
          <select value={filters.city} onChange={(event) => updateFilter("city", event.target.value)}>
            <option value="">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Event type</span>
          <select
            value={filters.primaryType}
            onChange={(event) => updateFilter("primaryType", event.target.value)}
          >
            <option value="">All event types</option>
            {primaryEventTypeOptions.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Audience</span>
          <select
            value={filters.audienceTag}
            onChange={(event) => updateFilter("audienceTag", event.target.value)}
          >
            <option value="">All audiences</option>
            {audienceAndMinistryOptions.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Language</span>
          <select
            value={filters.language}
            onChange={(event) => updateFilter("language", event.target.value)}
          >
            <option value="">All languages</option>
            {languageOptions.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">From date</span>
            <input
              type="date"
              value={filters.startsOnOrAfter}
              onChange={(event) => updateFilter("startsOnOrAfter", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Through date</span>
            <input
              type="date"
              min={filters.startsOnOrAfter || undefined}
              value={filters.startsOnOrBefore}
              onChange={(event) => updateFilter("startsOnOrBefore", event.target.value)}
            />
          </label>
        </div>

        <div className="events-filter-panel__toggles">
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={filters.childcareProvided}
              onChange={(event) => updateFilter("childcareProvided", event.target.checked)}
            />
            <span>Childcare provided</span>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={filters.wheelchairAccessible}
              onChange={(event) => updateFilter("wheelchairAccessible", event.target.checked)}
            />
            <span>Accessibility details listed</span>
          </label>
        </div>

        <button
          type="button"
          className="button button--ghost"
          onClick={() => setFilters(emptyEventFilters)}
        >
          Reset filters
        </button>
      </aside>

      <div className="events-results">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <h3>{events.length === 0 ? "No community events are listed yet" : "No events matched your filters"}</h3>
            <p>
              {events.length === 0
                ? "As churches begin adding events, they will appear here for the community to discover."
                : "Try clearing filters or searching with a broader keyword."}
            </p>
          </div>
        ) : (
          <div className="event-list">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
