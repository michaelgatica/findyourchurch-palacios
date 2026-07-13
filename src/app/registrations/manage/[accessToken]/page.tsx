import { notFound } from "next/navigation";

import { RegistrationFieldsEditor } from "@/components/registration/registration-fields-editor";
import { createPageMetadata } from "@/lib/config/site";
import { registrantCancelAction, registrantUpdateAction } from "@/lib/actions/registrations";
import { getRegistrantManagementContext } from "@/lib/services/public-registration-service";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Manage Registration",
  description: "Review, update, or cancel an event registration.",
  pathname: "/registrations/manage",
  noIndex: true,
});

export default async function RegistrantManagementPage(props: {
  params: Promise<{ accessToken: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { accessToken } = await props.params;
  const searchParams = await props.searchParams;
  const context = await getRegistrantManagementContext(accessToken);
  if (!context) notFound();

  return (
    <main className="shell page-section registration-management-page">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Manage registration</p>
        <h1>{context.event.title}</h1>
        <p>Confirmation number: <strong>{context.registration.confirmationNumber}</strong></p>
        <span className={`status-badge status-badge--${context.registration.status}`}>{context.registration.status.replaceAll("_", " ")}</span>
      </div>
      {searchParams.success ? <div className="form-alert form-alert--success" role="status">{searchParams.success}</div> : null}
      {searchParams.error ? <div className="form-alert" role="alert">{searchParams.error}</div> : null}

      {context.configuration.allowRegistrantEditing && context.registration.status !== "cancelled" ? (
        <form action={registrantUpdateAction} className="panel">
          <input type="hidden" name="accessToken" value={accessToken} />
          <RegistrationFieldsEditor sections={context.formVersion.sections} initialAnswers={context.registration.answers} />
          <button type="submit" className="button button--primary">Save registration changes</button>
        </form>
      ) : null}

      {context.configuration.allowRegistrantCancellation && context.registration.status !== "cancelled" ? (
        <form action={registrantCancelAction} className="panel registration-cancel-panel">
          <input type="hidden" name="accessToken" value={accessToken} />
          <h2>Cancel registration</h2>
          <p>Cancellation releases your reserved capacity and may promote the next waitlisted registration.</p>
          <button type="submit" className="button button--danger">Cancel this registration</button>
        </form>
      ) : null}
    </main>
  );
}
