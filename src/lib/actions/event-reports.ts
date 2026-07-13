"use server";

import { headers } from "next/headers";

import { createEventReportInFirebase } from "@/lib/repositories/firebase-event-admin-repository";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { getPublicEventBySlugFromFirebase } from "@/lib/repositories/firebase-event-repository";
import { createOperationalEvent } from "@/lib/services/operational-log-service";
import { eventReportReasons } from "@/lib/types/events";
import { createHash } from "crypto";

function hashOptional(value: string | null) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export async function submitEventReportAction(formData: FormData) {
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const reporterName = String(formData.get("reporterName") ?? "").trim();
  const reporterEmail = String(formData.get("reporterEmail") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  if (website) {
    return;
  }

  if (!eventSlug || !eventReportReasons.includes(reason as never)) {
    throw new Error("Choose a valid report reason.");
  }

  if (message.length < 10 || message.length > 1200) {
    throw new Error("Please provide a brief explanation between 10 and 1200 characters.");
  }

  const event = await getPublicEventBySlugFromFirebase(eventSlug);
  if (!event) {
    throw new Error("The event could not be found.");
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");

  const report = await createEventReportInFirebase({
    eventId: event.id,
    eventTitle: event.title,
    eventSlug: event.slug,
    churchId: event.churchId,
    churchName: event.churchName,
    reason: reason as never,
    message,
    reporterName: reporterName || null,
    reporterEmail: reporterEmail || null,
    internalNote: null,
    ipHash: hashOptional(forwardedFor),
    userAgentHash: hashOptional(userAgent),
  });

  await createAuditLogInFirebase({
    entityType: "eventReport",
    entityId: report.id,
    action: "event_report_created",
    actorType: "public",
    actorRole: "visitor",
    after: { eventId: event.id, reason: report.reason },
    note: "Public event report submitted. Reporter details are private.",
  });
  await createOperationalEvent({
    type: "event_report_created",
    severity: "warning",
    entityType: "eventReport",
    entityId: report.id,
    summary: "Public event report submitted for moderation.",
    metadata: { eventId: event.id, reason: report.reason },
  });
}
