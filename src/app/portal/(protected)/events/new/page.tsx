import { EventEditorForm } from "@/components/portal/event-editor-form";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

interface NewEventPageProps {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church || !context.representative) {
    return null;
  }

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Create Event</p>
        <h1>Create an event for {context.church.name}</h1>
        <p className="supporting-text">
          Save a draft while you gather details, or publish when the event is ready for the
          community calendar.
        </p>
      </div>

      <EventEditorForm
        church={context.church}
        errorMessage={resolvedSearchParams.error}
        successMessage={resolvedSearchParams.success}
      />
    </div>
  );
}
