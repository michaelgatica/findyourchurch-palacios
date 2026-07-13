import Link from "next/link";

import { RegistrationFormBuilder } from "@/components/portal/registration-form-builder";
import { duplicateRegistrationFormAction } from "@/lib/actions/registrations";
import { listManageableEventsForChurch } from "@/lib/services/event-management-service";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getEventRegistrationPortalData } from "@/lib/services/registration-form-service";

export default async function RegistrationFormBuilderPage(props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ eventId }, searchParams, context] = await Promise.all([
    props.params,
    props.searchParams,
    getRepresentativePortalContext(),
  ]);
  if (!context?.church || !context.representative) return null;

  const [data, churchEvents] = await Promise.all([
    getEventRegistrationPortalData({
      eventId,
      churchId: context.church.id,
      actorUserId: context.profile.id,
    }),
    listManageableEventsForChurch({
      churchId: context.church.id,
      actorUserId: context.profile.id,
      limit: 100,
    }),
  ]);
  const editableForm = data.draftForm ?? data.activeForm;

  return (
    <div className="admin-content">
      {searchParams.error ? <div className="form-alert" role="alert">{searchParams.error}</div> : null}
      {searchParams.success ? <div className="form-alert form-alert--success" role="status">{searchParams.success}</div> : null}
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Registration setup</p>
        <h1>{data.event.title}</h1>
        <p className="supporting-text">Configure capacity, waitlists, confirmation options, retention, and the exact form visitors will complete.</p>
        <div className="button-row"><Link href={`/portal/events/${eventId}/registration`} className="button button--ghost">Back to registrations</Link></div>
      </div>
      {churchEvents.some((event) => event.id !== eventId) ? (
        <form action={duplicateRegistrationFormAction} className="panel registration-copy-form">
          <input type="hidden" name="targetEventId" value={eventId} />
          <input type="hidden" name="churchId" value={context.church.id} />
          <div>
            <p className="eyebrow">Reuse a form</p>
            <h2>Copy from another event</h2>
            <p className="supporting-text">
              The copied form is saved as a draft. Existing registrations and answers are never copied.
            </p>
          </div>
          <label className="field">
            <span className="field__label">Source event</span>
            <select name="sourceEventId" required defaultValue="">
              <option value="" disabled>Choose an event</option>
              {churchEvents.filter((event) => event.id !== eventId).map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="button button--ghost">Copy form</button>
        </form>
      ) : null}
      <RegistrationFormBuilder
        eventId={eventId}
        churchId={context.church.id}
        eventTitle={data.event.title}
        configuration={data.configuration}
        initialSections={editableForm?.sections}
        initialFormTitle={editableForm?.title}
        initialPresetId={editableForm?.presetId}
      />
    </div>
  );
}
