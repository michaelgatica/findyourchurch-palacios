import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { isSameOriginRequest } from "@/lib/server/origin";
import {
  getEventEditorSubmissionEventId,
  saveEventEditorSubmission,
} from "@/lib/services/event-editor-submission-service";

function buildRedirectUrl(publicOrigin: string, pathname: string, key: "success" | "error", value: string) {
  const redirectUrl = new URL(pathname, publicOrigin);
  redirectUrl.searchParams.set(key, value);
  return redirectUrl;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);

  if (!isSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const publicOrigin =
    request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? requestUrl.origin;

  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();
  if (!authenticatedUser?.profile) {
    return Response.redirect(new URL("/portal/login", publicOrigin), 303);
  }

  const formData = await request.formData();
  const eventId = getEventEditorSubmissionEventId(formData);
  const redirectBase = eventId ? `/portal/events/${eventId}/edit` : "/portal/events/new";

  try {
    const result = await saveEventEditorSubmission({
      formData,
      actorUserId: authenticatedUser.profile.id,
    });
    return Response.redirect(
      buildRedirectUrl(
        publicOrigin,
        `/portal/events/${result.event.id}/edit`,
        "success",
        result.publishNow ? "event-published" : "event-saved",
      ),
      303,
    );
  } catch (error) {
    return Response.redirect(
      buildRedirectUrl(
        publicOrigin,
        redirectBase,
        "error",
        error instanceof Error ? error.message : "Unable to save the event.",
      ),
      303,
    );
  }
}
