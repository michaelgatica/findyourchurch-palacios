import { getPublicEventBySlug } from "@/lib/repositories/event-repository";
import { buildEventCalendarFile } from "@/lib/event-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await context.params;
  const event = await getPublicEventBySlug(eventSlug);

  if (!event) {
    return new Response("Event not found.", { status: 404 });
  }

  const safeFilename = `${event.slug.replace(/[^a-z0-9-]/gi, "-")}.ics`;

  return new Response(buildEventCalendarFile(event), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Type": "text/calendar; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
