import Link from "next/link";

import { createRegistrationExportAction, emailRegistrationReportAction } from "@/lib/actions/registration-exports";
import { flattenRegistrationFields, isSensitiveField } from "@/lib/registration-utils";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getEventRegistrationPortalData } from "@/lib/services/registration-form-service";

export default async function RegistrationExportsPage(props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ eventId }, searchParams, context] = await Promise.all([props.params, props.searchParams, getRepresentativePortalContext()]);
  if (!context?.church || !context.representative) return null;
  const data = await getEventRegistrationPortalData({ eventId, churchId: context.church.id, actorUserId: context.profile.id });
  const fields = new Map();
  data.formVersions.forEach((version) => flattenRegistrationFields(version.sections).forEach((field) => {
    if (!fields.has(field.id) && !["section_heading", "informational_text"].includes(field.type)) fields.set(field.id, field);
  }));
  const exportFields = [...fields.values()];
  const approvedRecipients = [context.profile.email, data.event.contactEmail, context.church.email].filter(Boolean);

  return <div className="admin-content">
    {searchParams.success ? <div className="form-alert form-alert--success" role="status">{searchParams.success}</div> : null}
    {searchParams.error ? <div className="form-alert" role="alert">{searchParams.error}</div> : null}
    <div className="panel"><p className="eyebrow eyebrow--gold">Reports and exports</p><h1>{data.event.title}</h1><p>Exports are generated server-side, stored privately, expire after 24 hours, and are audited. Sensitive fields are excluded unless you deliberately include them.</p><Link href={`/portal/events/${eventId}/registration`} className="button button--ghost">Back to registrations</Link></div>
    <form action={createRegistrationExportAction} className="panel registration-export-form">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="churchId" value={context.church.id} />
      <h2>Download a report</h2>
      <div className="form-grid"><label className="field"><span className="field__label">Format</span><select name="format"><option value="pdf">PDF</option><option value="xlsx">Excel workbook (.xlsx)</option></select></label><label className="field"><span className="field__label">PDF layout</span><select name="reportType"><option value="roster">Registration roster</option><option value="sign_in">Sign-in sheet</option><option value="check_in">Check-in sheet</option></select></label><label className="field"><span className="field__label">Orientation</span><select name="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>
      <ExportFieldPicker fields={exportFields} />
      <button type="submit" className="button button--primary">Create secure download</button>
    </form>
    <form action={emailRegistrationReportAction} className="panel registration-export-form">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="churchId" value={context.church.id} />
      <h2>Email reports</h2><p className="supporting-text">Approved recipients: {approvedRecipients.join(", ") || "No event or church contact email is configured."}</p>
      <div className="form-grid"><label className="field"><span className="field__label">Recipients</span><input name="recipients" defaultValue={context.profile.email} required /><span className="field__hint">Use commas for more than one approved address.</span></label><label className="field"><span className="field__label">Report type</span><select name="reportType"><option value="roster">Roster</option><option value="sign_in">Sign-in sheet</option><option value="check_in">Check-in sheet</option></select></label><label className="field"><span className="field__label">Orientation</span><select name="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>
      <div className="event-inline-options"><label><input type="checkbox" name="formats" value="pdf" defaultChecked /> PDF</label><label><input type="checkbox" name="formats" value="xlsx" /> Excel workbook</label></div>
      <label className="field"><span className="field__label">Short message</span><textarea name="message" rows={3} maxLength={1000} /></label>
      <ExportFieldPicker fields={exportFields} />
      <button type="submit" className="button button--primary">Email report</button>
    </form>
  </div>;
}

function ExportFieldPicker({ fields }: { fields: Array<{ id: string; label: string; includeInExports: boolean; sensitiveClassification: string }> }) {
  const hasSensitive = fields.some((field) => isSensitiveField(field as never));
  return <fieldset className="registration-export-fields"><legend>Columns</legend>{fields.map((field) => {
    const sensitive = field.sensitiveClassification !== "none" && field.sensitiveClassification !== "standard_contact";
    return <label key={field.id} className={sensitive ? "registration-export-field registration-export-field--sensitive" : "registration-export-field"}><input type="checkbox" name="selectedFieldIds" value={field.id} defaultChecked={field.includeInExports && !sensitive} /><span>{field.label}{sensitive ? ` · Sensitive (${field.sensitiveClassification.replaceAll("_", " ")})` : ""}</span></label>;
  })}{hasSensitive ? <label className="registration-sensitive-confirmation"><input type="checkbox" name="includeSensitive" /> I deliberately authorize sensitive selected fields in this report.</label> : null}</fieldset>;
}
