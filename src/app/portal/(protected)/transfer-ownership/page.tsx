import { requestOwnershipTransferAction } from "@/lib/actions/portal";
import { formatDateTime } from "@/lib/formatting";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getRepresentativeTeamData } from "@/lib/services/representative-team-service";

interface PortalTransferOwnershipPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function PortalTransferOwnershipPage({
  searchParams,
}: PortalTransferOwnershipPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church || !context.representative) {
    return null;
  }

  const { transferRequests } = await getRepresentativeTeamData(context.church.id);
  const canRequestTransfer = context.representative.permissionRole === "primary_owner";

  return (
    <div className="admin-content">
      {resolvedSearchParams.success ? (
        <div className="form-alert form-alert--success">
          Your ownership transfer request has been submitted.
        </div>
      ) : null}
      {resolvedSearchParams.error ? (
        <div className="form-alert">{resolvedSearchParams.error}</div>
      ) : null}

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Transfer Ownership</p>
        <h1>Request a new primary owner</h1>
        <p className="supporting-text">
          Transfers do not happen automatically. The review team must approve the request before
          primary ownership changes. Please allow up to 24 hours for review after submission.
        </p>
      </div>

      <div className="panel">
        {canRequestTransfer ? (
          <form action={requestOwnershipTransferAction} className="submission-form">
            <input type="hidden" name="churchId" value={context.church.id} />
            <div className="form-grid">
              <label className="field">
                <span className="field__label">New owner name</span>
                <input name="newOwnerName" required />
              </label>
              <label className="field">
                <span className="field__label">New owner email</span>
                <input name="newOwnerEmail" type="email" required />
              </label>
              <label className="field">
                <span className="field__label">New owner phone</span>
                <input name="newOwnerPhone" />
              </label>
              <label className="field">
                <span className="field__label">New owner role / title</span>
                <input name="newOwnerRoleTitle" required />
              </label>
              <label className="field field--full">
                <span className="field__label">Reason / message</span>
                <textarea
                  name="reasonMessage"
                  placeholder="Explain why ownership should be transferred."
                  required
                />
              </label>
            </div>
            <div className="submission-form__actions">
              <button type="submit" className="button button--primary">
                Submit transfer request
              </button>
            </div>
          </form>
        ) : (
          <p className="supporting-text">
            Only the primary owner can request an ownership transfer.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Recent transfer requests</h2>
        {transferRequests.length === 0 ? (
          <p className="supporting-text">No ownership transfer requests are on file.</p>
        ) : (
          <div className="timeline">
            {transferRequests.map((transferRequest) => (
              <div key={transferRequest.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{transferRequest.status.replace(/_/g, " ")}</span>
                  <span>{formatDateTime(transferRequest.createdAt)}</span>
                </div>
                <p>
                  Requested new owner: {transferRequest.newOwnerName} ({transferRequest.newOwnerEmail})
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
