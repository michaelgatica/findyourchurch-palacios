import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  approveOwnershipTransferRequestAction,
  denyOwnershipTransferRequestAction,
  sendAdminChurchMessageAction,
  suspendRepresentativeAction,
  toggleChurchAutoPublishUpdatesAction,
} from "@/lib/actions/admin-review";
import { formatDateTime } from "@/lib/formatting";
import { getPublicChurchMessageThread } from "@/lib/services/church-messaging-service";
import { getRepresentativeTeamData } from "@/lib/services/representative-team-service";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import { listChurchUpdateRequests } from "@/lib/repositories/firebase-update-request-repository";

interface AdminChurchRepresentativesPageProps {
  params: Promise<{
    churchId: string;
  }>;
}

export default async function AdminChurchRepresentativesPage({
  params,
}: AdminChurchRepresentativesPageProps) {
  const { churchId } = await params;
  const church = await getChurchByIdFromFirebase(churchId);

  if (!church) {
    notFound();
  }

  const [{ representatives, transferRequests }, updateRequests, messages] = await Promise.all([
    getRepresentativeTeamData(church.id),
    listChurchUpdateRequests({
      churchId: church.id,
      limit: 10,
    }),
    getPublicChurchMessageThread(church.id),
  ]);
  const primaryRepresentative =
    representatives.find((representative) => representative.permissionRole === "primary_owner") ??
    representatives[0] ??
    null;

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Representative Management</p>
            <h1>{church.name}</h1>
            <p className="supporting-text">
              Manage auto-publish settings, representative access, transfer requests, and church
              messages.
            </p>
          </div>
          <AdminStatusBadge status={church.status} />
        </div>
      </div>

      <div className="panel">
        <form action={toggleChurchAutoPublishUpdatesAction} className="submission-form">
          <input type="hidden" name="churchId" value={church.id} />
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="autoPublishUpdates"
              defaultChecked={church.autoPublishUpdates ?? false}
            />
            <span>Auto-publish representative listing updates</span>
          </label>
          <div className="submission-form__actions">
            <button type="submit" className="button button--primary">
              Save update mode
            </button>
          </div>
        </form>
      </div>

      <div className="admin-two-column">
        <div className="panel">
          <h2>Representatives</h2>
          <div className="timeline">
            {representatives.map((representative) => (
              <div key={representative.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>
                    {representative.name} · {representative.permissionRole.replace(/_/g, " ")}
                  </span>
                  <span>{representative.status.replace(/_/g, " ")}</span>
                </div>
                <p>{representative.email}</p>
                {representative.status === "active" ? (
                  <form action={suspendRepresentativeAction}>
                    <input type="hidden" name="churchId" value={church.id} />
                    <input type="hidden" name="representativeId" value={representative.id} />
                    <button type="submit" className="button button--ghost">
                      Suspend access
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Pending update requests</h2>
          {updateRequests.length === 0 ? (
            <p className="supporting-text">No representative update requests are on file.</p>
          ) : (
            <div className="timeline">
              {updateRequests.map((updateRequest) => (
                <div key={updateRequest.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>{updateRequest.status.replace(/_/g, " ")}</span>
                    <span>{formatDateTime(updateRequest.createdAt)}</span>
                  </div>
                  <p>{updateRequest.proposedChanges.description}</p>
                  <Link href={`/admin/updates/${updateRequest.id}`} className="button button--ghost">
                    Open update request
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="admin-two-column">
        <div className="panel">
          <h2>Ownership transfer requests</h2>
          {transferRequests.length === 0 ? (
            <p className="supporting-text">No transfer requests are on file.</p>
          ) : (
            <div className="timeline">
              {transferRequests.map((transferRequest) => (
                <div key={transferRequest.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>{transferRequest.newOwnerName}</span>
                    <span>{transferRequest.status.replace(/_/g, " ")}</span>
                  </div>
                  <p>{transferRequest.newOwnerEmail}</p>
                  {transferRequest.status === "pending_review" ? (
                    <div className="button-row">
                      <form action={approveOwnershipTransferRequestAction}>
                        <input type="hidden" name="transferRequestId" value={transferRequest.id} />
                        <input type="hidden" name="churchId" value={church.id} />
                        <button type="submit" className="button button--primary">
                          Approve transfer
                        </button>
                      </form>
                      <form action={denyOwnershipTransferRequestAction} className="submission-form">
                        <input type="hidden" name="transferRequestId" value={transferRequest.id} />
                        <input type="hidden" name="churchId" value={church.id} />
                        <label className="field field--full">
                          <span className="field__label">Deny message</span>
                          <textarea name="adminMessage" required />
                        </label>
                        <button type="submit" className="button button--ghost">
                          Deny transfer
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Messages</h2>
          {primaryRepresentative ? (
            <form action={sendAdminChurchMessageAction} className="submission-form">
              <input type="hidden" name="churchId" value={church.id} />
              <input type="hidden" name="recipientEmail" value={primaryRepresentative.email} />
              <label className="field field--full">
                <span className="field__label">Message to representative</span>
                <textarea name="messageBody" required />
              </label>
              <button type="submit" className="button button--secondary">
                Send message
              </button>
            </form>
          ) : (
            <p className="supporting-text">No primary representative is currently assigned.</p>
          )}

          <div className="timeline">
            {messages.map((message) => (
              <div key={message.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{message.senderType.replace(/_/g, " ")}</span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p>{message.messageBody}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="button-row">
        <Link href="/admin/churches" className="button button--ghost">
          Back to churches
        </Link>
      </div>
    </div>
  );
}
