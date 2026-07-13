import Link from "next/link";

import { RegistrationFieldsEditor } from "@/components/registration/registration-fields-editor";
import { createManualRegistrationAction } from "@/lib/actions/registrations";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getEventRegistrationPortalData } from "@/lib/services/registration-form-service";

export default async function ManualRegistrationPage(props: { params: Promise<{ eventId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ eventId }, searchParams, context] = await Promise.all([props.params, props.searchParams, getRepresentativePortalContext()]);
  if (!context?.church || !context.representative) return null;
  const data = await getEventRegistrationPortalData({ eventId, churchId: context.church.id, actorUserId: context.profile.id });

  return <div className="admin-content">
    {searchParams.error ? <div className="form-alert" role="alert">{searchParams.error}</div> : null}
    <div className="panel"><p className="eyebrow eyebrow--gold">Manual registration</p><h1>{data.event.title}</h1><p>Use the active form to add a phone, walk-in, or office registration.</p><Link href={`/portal/events/${eventId}/registration`} className="button button--ghost">Back</Link></div>
    {data.activeForm ? <form action={createManualRegistrationAction} className="panel"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="churchId" value={context.church.id} /><RegistrationFieldsEditor sections={data.activeForm.sections} /><button className="button button--primary" type="submit">Add registration</button></form> : <div className="panel"><p>Activate an internal registration form first.</p><Link href={`/portal/events/${eventId}/registration/form`} className="button button--primary">Set up registration</Link></div>}
  </div>;
}
