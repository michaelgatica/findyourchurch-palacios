import { inviteChurchEditorAction } from "@/lib/actions/portal";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getRepresentativeTeamData } from "@/lib/services/representative-team-service";

interface PortalTeamPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function PortalTeamPage({ searchParams }: PortalTeamPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church || !context.representative) {
    return null;
  }

  const teamData = await getRepresentativeTeamData(context.church.id);
  const canInviteEditor = context.representative.permissionRole === "primary_owner";

  return (
    <div className="admin-content">
      {resolvedSearchParams.success ? (
        <div className="form-alert form-alert--success">Your editor invitation has been sent.</div>
      ) : null}
      {resolvedSearchParams.error ? (
        <div className="form-alert">{resolvedSearchParams.error}</div>
      ) : null}

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Church Team</p>
        <h1>Representatives for this listing</h1>
        <p className="supporting-text">
          One primary owner and one additional editor are supported in this phase. Editors can help
          update the listing, but only the primary owner can invite an editor or request ownership
          transfer.
        </p>
      </div>

      <div className="admin-card-list">
        {teamData.representatives.map((representative) => (
          <div key={representative.id} className="panel admin-card-list__item">
            <div className="admin-card-list__header">
              <div>
                <h2>{representative.name}</h2>
                <p className="supporting-text">
                  {representative.email} - {representative.roleTitle}
                </p>
              </div>
              <span className={`status-badge status-badge--${representative.status}`}>
                {representative.permissionRole.replace(/_/g, " ")} /{" "}
                {representative.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Invite one editor</h2>
        {canInviteEditor ? (
          <form action={inviteChurchEditorAction} className="submission-form">
            <input type="hidden" name="churchId" value={context.church.id} />
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Editor name</span>
                <input name="editorName" required />
              </label>
              <label className="field">
                <span className="field__label">Editor email</span>
                <input name="editorEmail" type="email" required />
              </label>
              <label className="field">
                <span className="field__label">Editor phone</span>
                <input name="editorPhone" />
              </label>
              <label className="field">
                <span className="field__label">Role / title</span>
                <input name="editorRoleTitle" required />
              </label>
            </div>
            <p className="supporting-text">
              The invited editor should sign in or create an account using the same email address
              entered here. Only one editor can be invited at a time in this phase.
            </p>
            <div className="submission-form__actions">
              <button type="submit" className="button button--primary">
                Invite editor
              </button>
            </div>
          </form>
        ) : (
          <p className="supporting-text">
            Only the primary owner can invite an editor for this church.
          </p>
        )}
      </div>
    </div>
  );
}
