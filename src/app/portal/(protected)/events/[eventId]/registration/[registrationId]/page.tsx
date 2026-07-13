import Link from "next/link";

import { RegistrationFieldsEditor } from "@/components/registration/registration-fields-editor";
import { manageRegistrationAction } from "@/lib/actions/registrations";
import { formatDateTime } from "@/lib/formatting";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getManagedRegistration } from "@/lib/services/registration-management-service";

export default async function RegistrationDetailPage(props: {
  params: Promise<{ eventId: string; registrationId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, searchParams, context] = await Promise.all([props.params, props.searchParams, getRepresentativePortalContext()]);
  if (!context?.church || !context.representative) return null;
  const data = await getManagedRegistration({
    eventId: params.eventId,
    registrationId: params.registrationId,
    churchId: context.church.id,
    actorUserId: context.profile.id,
  });

  return <div className="admin-content">
    {searchParams.success ? <div className="form-alert form-alert--success" role="status">{searchParams.success}</div> : null}
    {searchParams.error ? <div className="form-alert" role="alert">{searchParams.error}</div> : null}
    <div className="panel">
      <p className="eyebrow eyebrow--gold">Registration detail</p>
      <h1>{data.registration.contactName}</h1>
      <dl className="event-admin-row__meta">
        <div><dt>Status</dt><dd>{data.registration.status.replaceAll("_", " ")}</dd></div>
        <div><dt>Confirmation</dt><dd>{data.registration.confirmationNumber}</dd></div>
        <div><dt>Submitted</dt><dd>{formatDateTime(data.registration.submittedAt)}</dd></div>
        <div><dt>Form version</dt><dd>{data.registration.formVersion}</dd></div>
      </dl>
      <div className="button-row"><Link href={`/portal/events/${params.eventId}/registration`} className="button button--ghost">Back to registrations</Link></div>
    </div>

    {data.formVersion ? <form action={manageRegistrationAction} className="panel">
      <input type="hidden" name="eventId" value={params.eventId} />
      <input type="hidden" name="churchId" value={context.church.id} />
      <input type="hidden" name="registrationId" value={params.registrationId} />
      <RegistrationFieldsEditor sections={data.formVersion.sections} initialAnswers={data.registration.answers} />
      <label className="field"><span className="field__label">Private organizer notes</span><textarea name="privateOrganizerNotes" defaultValue={data.registration.privateOrganizerNotes ?? ""} maxLength={2000} rows={4} /><span className="field__hint">Private notes are never included on public pages or in ordinary notification emails.</span></label>
      <button type="submit" name="intent" value="update" className="button button--primary">Save registration</button>
    </form> : null}

    <div className="panel">
      <h2>Registration actions</h2>
      <div className="registration-action-grid">
        {data.registration.status === "waitlisted" ? <Action intent="mark_confirmed" label="Promote from waitlist" {...params} churchId={context.church.id} /> : null}
        {data.registration.status === "confirmed" ? <Action intent="mark_waitlisted" label="Move to waitlist" {...params} churchId={context.church.id} /> : null}
        {data.registration.status === "confirmed" ? <Action intent="mark_checked_in" label="Mark checked in" {...params} churchId={context.church.id} /> : null}
        {data.registration.status === "checked_in" ? <Action intent="mark_confirmed" label="Undo check-in" {...params} churchId={context.church.id} /> : null}
        {data.registration.status === "confirmed" || data.registration.status === "checked_in" ? <Action intent="mark_attended" label="Mark attended" {...params} churchId={context.church.id} /> : null}
        {data.registration.status === "confirmed" || data.registration.status === "checked_in" ? <Action intent="mark_no_show" label="Mark no show" {...params} churchId={context.church.id} /> : null}
        {data.registration.status === "confirmed" || data.registration.status === "waitlisted" || data.registration.status === "checked_in" ? <Action intent="mark_cancelled" label="Cancel registration" {...params} churchId={context.church.id} danger /> : null}
        <Action intent="resend_confirmation" label="Resend confirmation" {...params} churchId={context.church.id} />
        {data.registration.status === "cancelled" ? <Action intent="delete_data" label="Delete personal data" {...params} churchId={context.church.id} danger /> : null}
      </div>
    </div>

    <div className="panel">
      <p className="eyebrow">Audit history</p>
      <h2>Recent activity</h2>
      {data.auditLogs.length === 0 ? <p>No audit entries are available yet.</p> : (
        <div className="registration-audit-list">
          {data.auditLogs.slice(0, 25).map((entry) => (
            <div key={entry.id} className="registration-audit-entry">
              <div>
                <strong>{entry.action.replaceAll("_", " ")}</strong>
                <p>{entry.note ?? "Registration activity recorded."}</p>
              </div>
              <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
            </div>
          ))}
        </div>
      )}
      <p className="field__hint">Audit entries intentionally omit registration answers and other sensitive values.</p>
    </div>
  </div>;
}

function Action(props: { eventId: string; registrationId: string; churchId: string; intent: string; label: string; danger?: boolean }) {
  return <form action={manageRegistrationAction}><input type="hidden" name="eventId" value={props.eventId} /><input type="hidden" name="churchId" value={props.churchId} /><input type="hidden" name="registrationId" value={props.registrationId} /><input type="hidden" name="intent" value={props.intent} /><button type="submit" className={`button ${props.danger ? "button--danger" : "button--ghost"}`}>{props.label}</button></form>;
}
