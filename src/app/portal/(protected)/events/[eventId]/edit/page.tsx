import { notFound } from "next/navigation";

import { EventEditorForm } from "@/components/portal/event-editor-form";
import { getManageableEvent } from "@/lib/services/event-management-service";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

interface EditEventPageProps {
  params: Promise<{
    eventId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}

function getSuccessMessage(value?: string) {
  switch (value) {
    case "event-saved":
      return "Event saved.";
    case "event-published":
      return "Event published.";
    case "event-duplicated":
      return "Event duplicated.";
    default:
      return value;
  }
}

export default async function EditEventPage({ params, searchParams }: EditEventPageProps) {
  const [context, resolvedParams, resolvedSearchParams] = await Promise.all([
    getRepresentativePortalContext(),
    params,
    searchParams,
  ]);

  if (!context?.church || !context.representative) {
    return null;
  }

  const event = await getManageableEvent({
    eventId: resolvedParams.eventId,
    churchId: context.church.id,
    actorUserId: context.profile.id,
  }).catch(() => null);

  if (!event) {
    notFound();
  }

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Edit Event</p>
        <h1>{event.title}</h1>
        <p className="supporting-text">
          Update event details, replace the flyer, or publish changes when ready.
        </p>
      </div>

      <EventEditorForm
        church={context.church}
        event={event}
        errorMessage={resolvedSearchParams.error}
        successMessage={getSuccessMessage(resolvedSearchParams.success)}
      />
    </div>
  );
}
