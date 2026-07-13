"use server";

import { redirect } from "next/navigation";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { createRegistrationExport, emailRegistrationExport } from "@/lib/services/registration-export-service";

function stringValue(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

async function requireActor() {
  const user = await getServerAuthenticatedUserFromSessionCookie();
  if (!user?.profile) redirect("/portal/login");
  return user.profile;
}

export async function createRegistrationExportAction(formData: FormData) {
  const actor = await requireActor();
  const eventId = stringValue(formData, "eventId");
  try {
    const result = await createRegistrationExport({
      eventId,
      churchId: stringValue(formData, "churchId"),
      actorUserId: actor.id,
      format: stringValue(formData, "format") === "xlsx" ? "xlsx" : "pdf",
      reportType: stringValue(formData, "format") === "xlsx" ? "workbook" : stringValue(formData, "reportType") as "roster" | "sign_in" | "check_in",
      orientation: stringValue(formData, "orientation") === "landscape" ? "landscape" : "portrait",
      selectedFieldIds: formData.getAll("selectedFieldIds").map(String),
      includeSensitive: formData.get("includeSensitive") === "on",
    });
    redirect(`/api/portal/event-exports/${result.record.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/portal/events/${eventId}/exports?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create the export.")}`);
  }
}

export async function emailRegistrationReportAction(formData: FormData) {
  const actor = await requireActor();
  const eventId = stringValue(formData, "eventId");
  try {
    const formats = formData.getAll("formats").map(String).filter((value): value is "pdf" | "xlsx" => value === "pdf" || value === "xlsx");
    await emailRegistrationExport({
      eventId,
      churchId: stringValue(formData, "churchId"),
      actorUserId: actor.id,
      recipients: stringValue(formData, "recipients").split(/[;,]/),
      message: stringValue(formData, "message"),
      formats,
      reportType: stringValue(formData, "reportType") as "roster" | "sign_in" | "check_in",
      orientation: stringValue(formData, "orientation") === "landscape" ? "landscape" : "portrait",
      selectedFieldIds: formData.getAll("selectedFieldIds").map(String),
      includeSensitive: formData.get("includeSensitive") === "on",
    });
  } catch (error) {
    redirect(`/portal/events/${eventId}/exports?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to email the report.")}`);
  }
  redirect(`/portal/events/${eventId}/exports?success=Report+email+sent.`);
}
