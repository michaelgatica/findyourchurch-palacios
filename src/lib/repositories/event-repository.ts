import {
  getPublicEventBySlugFromFirebase,
  getUpcomingPublishedEventsForChurchFromFirebase,
  getUpcomingPublishedEventsFromFirebase,
} from "@/lib/repositories/firebase-event-repository";
import { getRepositoryMode } from "@/lib/repositories/repository-mode";
import type { EventRecord } from "@/lib/types/events";

const localEvents: EventRecord[] = [];

function canUseLocalEventFallback() {
  return process.env.NODE_ENV !== "production";
}

function sortUpcomingEvents(events: EventRecord[]) {
  const now = new Date().toISOString();

  return events
    .filter((event) => event.status === "published" && event.startsAt >= now)
    .sort((leftEvent, rightEvent) => leftEvent.startsAt.localeCompare(rightEvent.startsAt));
}

export async function getUpcomingPublishedEvents(limit = 12) {
  if (getRepositoryMode() === "firebase") {
    const events = await getUpcomingPublishedEventsFromFirebase(limit);

    if (events.length > 0 || !canUseLocalEventFallback()) {
      return events;
    }
  }

  if (!canUseLocalEventFallback()) {
    return [];
  }

  return sortUpcomingEvents(localEvents).slice(0, limit);
}

export async function getUpcomingPublishedEventsForChurch(churchId: string, limit = 6) {
  if (getRepositoryMode() === "firebase") {
    const events = await getUpcomingPublishedEventsForChurchFromFirebase(churchId, limit);

    if (events.length > 0 || !canUseLocalEventFallback()) {
      return events;
    }
  }

  if (!canUseLocalEventFallback()) {
    return [];
  }

  return sortUpcomingEvents(localEvents)
    .filter((event) => event.churchId === churchId)
    .slice(0, limit);
}

export async function getPublicEventBySlug(eventSlug: string) {
  if (getRepositoryMode() === "firebase") {
    const event = await getPublicEventBySlugFromFirebase(eventSlug);

    if (event || !canUseLocalEventFallback()) {
      return event;
    }
  }

  if (!canUseLocalEventFallback()) {
    return null;
  }

  return (
    localEvents.find(
      (event) =>
        event.slug === eventSlug &&
        (event.status === "published" || event.status === "unlisted"),
    ) ?? null
  );
}
