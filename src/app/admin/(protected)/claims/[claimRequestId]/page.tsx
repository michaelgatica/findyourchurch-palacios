import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  approveClaimRequestAction,
  denyClaimRequestAction,
  requestClaimMoreInfoAction,
  saveClaimInternalNoteAction,
  sendClaimPublicMessageAction,
} from "@/lib/actions/admin-review";
import { buildChurchProfilePath } from "@/lib/config/site";
import { formatDateTime } from "@/lib/formatting";
import { getAdminClaimReviewData } from "@/lib/services/admin-claim-review-service";

interface AdminClaimDetailPageProps {
  params: Promise<{
    claimRequestId: string;
  }>;
}

export default async function AdminClaimDetailPage({ params }: AdminClaimDetailPageProps) {
  const resolvedParams = await params;
  const reviewData = await getAdminClaimReviewData(resolvedParams.claimRequestId);

  if (!reviewData) {
    notFound();
  }

  const { claimRequest, church, messages, auditLogs, emailLogs } = reviewData;
  const redirectTo = `/admin/claims/${claimRequest.id}`;
  const canReviewClaim =
    claimRequest.status === "pending_review" || claimRequest.status === "more_info_requested";
  const authorizationExplanation =
    claimRequest.authorizationExplanation ??
    claimRequest.proofOrExplanation ??
    claimRequest.relationshipToChurch ??
    "Not provided";
  const verifierContact = [
    claimRequest.verifierName,
    claimRequest.verifierRoleTitle,
    claimRequest.verifierPhone,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Claim Request Review</p>
            <h1>{claimRequest.requesterName}</h1>
            <p className="supporting-text">
              Request received on {formatDateTime(claimRequest.createdAt)} for church ID{" "}
              {claimRequest.churchId}.
            </p>
          </div>

          <AdminStatusBadge status={claimRequest.status} />
        </div>

        <div className="button-row">
          <Link href="/admin/claims" className="button button--ghost">
            Back to claims
          </Link>
          {church ? (
            <Link href={buildChurchProfilePath(church)} className="button button--ghost">
              View public church page
            </Link>
          ) : null}
        </div>
      </div>

      <div className="admin-review-grid">
        {canReviewClaim ? (
          <>
            <div className="panel">
              <h2>Approve claim</h2>
              <p className="supporting-text">
                Approving this request assigns a primary representative record to the church and marks
                the claim as approved in Firestore.
              </p>
              <form action={approveClaimRequestAction} className="field-stack">
                <input type="hidden" name="claimRequestId" value={claimRequest.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button type="submit" className="button button--primary">
                  Approve claim
                </button>
              </form>
            </div>

            <div className="panel">
              <h2>Request more information</h2>
              <form action={requestClaimMoreInfoAction} className="field-stack">
                <input type="hidden" name="claimRequestId" value={claimRequest.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="field">
                  <span className="field__label">Message to requester</span>
                  <textarea
                    name="adminMessage"
                    placeholder="Explain what additional information is needed."
                    required
                  />
                </label>
                <button type="submit" className="button button--secondary">
                  Request more info
                </button>
              </form>
            </div>

            <div className="panel">
              <h2>Deny claim</h2>
              <form action={denyClaimRequestAction} className="field-stack">
                <input type="hidden" name="claimRequestId" value={claimRequest.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="field">
                  <span className="field__label">Message to requester</span>
                  <textarea
                    name="adminMessage"
                    placeholder="Share the reason this request cannot be approved."
                    required
                  />
                </label>
                <button type="submit" className="button button--ghost">
                  Deny claim
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="panel">
            <h2>Review complete</h2>
            <p className="supporting-text">
              This claim has already been {claimRequest.status.replace(/_/g, " ")}. Review actions are
              disabled to prevent duplicate approval or denial emails.
            </p>
          </div>
        )}

        <div className="panel">
          <h2>Save internal note</h2>
          <form action={saveClaimInternalNoteAction} className="field-stack">
            <input type="hidden" name="claimRequestId" value={claimRequest.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Internal note</span>
              <textarea
                name="note"
                placeholder="Internal notes are visible only to admins."
                required
              />
            </label>
            <button type="submit" className="button button--ghost">
              Save note
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Send message to requester</h2>
          <form action={sendClaimPublicMessageAction} className="field-stack">
            <input type="hidden" name="claimRequestId" value={claimRequest.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Public message</span>
              <textarea
                name="messageBody"
                placeholder="This message is emailed to the requester and stored in Firestore."
                required
              />
            </label>
            <button type="submit" className="button button--secondary">
              Send message
            </button>
          </form>
        </div>
      </div>

      <div className="admin-two-column">
        <div className="panel">
          <h2>Requester details</h2>
          <div className="admin-detail-grid">
            <div>
              <strong>Name</strong>
              <p>{claimRequest.requesterName}</p>
            </div>
            <div>
              <strong>Email</strong>
              <p>{claimRequest.requesterEmail}</p>
            </div>
            <div>
              <strong>Phone</strong>
              <p>{claimRequest.requesterPhone ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Role / title</strong>
              <p>{claimRequest.requesterRoleTitle}</p>
            </div>
            <div>
              <strong>Authorization explanation</strong>
              <p>{authorizationExplanation}</p>
            </div>
            <div>
              <strong>Approving contact</strong>
              <p>{verifierContact || "Not provided"}</p>
            </div>
          </div>
        </div>

        <div className="admin-sidebar-stack">
          <div className="panel">
            <h2>Linked church</h2>
            {church ? (
              <div className="detail-list">
                <div className="detail-row">
                  <dt>Name</dt>
                  <dd>{church.name}</dd>
                </div>
                <div className="detail-row">
                  <dt>Denomination</dt>
                  <dd>{church.denomination}</dd>
                </div>
                <div className="detail-row">
                  <dt>Address</dt>
                  <dd>
                    {church.address.line1}
                    <br />
                    {church.address.city}, {church.address.stateCode} {church.address.postalCode}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Current primary representative</dt>
                  <dd>{church.primaryRepresentativeId ?? "Not yet assigned"}</dd>
                </div>
              </div>
            ) : (
              <p className="supporting-text">
                The related church record could not be loaded from Firestore.
              </p>
            )}
          </div>

          <div className="panel">
            <h2>Review history</h2>
            <div className="detail-list">
              <div className="detail-row">
                <dt>Status</dt>
                <dd>{claimRequest.status.replace(/_/g, " ")}</dd>
              </div>
              <div className="detail-row">
                <dt>Reviewed by</dt>
                <dd>{claimRequest.reviewedBy ?? "Not yet reviewed"}</dd>
              </div>
              <div className="detail-row">
                <dt>Reviewed at</dt>
                <dd>{formatDateTime(claimRequest.reviewedAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Admin message</dt>
                <dd>{claimRequest.adminMessage ?? "No admin message has been stored yet."}</dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-three-column">
        <div className="panel">
          <h2>Messages</h2>
          {messages.length === 0 ? (
            <p className="supporting-text">No messages have been stored for this claim yet.</p>
          ) : (
            <div className="timeline-list">
              {messages.map((message) => (
                <div key={message.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>{message.isInternal ? "Internal note" : "Public message"}</span>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.messageBody}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Email logs</h2>
          {emailLogs.length === 0 ? (
            <p className="supporting-text">No email log entries have been created yet.</p>
          ) : (
            <div className="timeline-list">
              {emailLogs.map((emailLog) => (
                <div key={emailLog.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>{emailLog.subject}</span>
                    <span>{formatDateTime(emailLog.createdAt)}</span>
                  </div>
                  <p>
                    To: {emailLog.to}
                    <br />
                    Status: {emailLog.status}
                    <br />
                    Preview: {emailLog.bodyPreview}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Audit log</h2>
          {auditLogs.length === 0 ? (
            <p className="supporting-text">No audit records have been written yet.</p>
          ) : (
            <div className="timeline-list">
              {auditLogs.map((auditLog) => (
                <div key={auditLog.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>{auditLog.action.replace(/_/g, " ")}</span>
                    <span>{formatDateTime(auditLog.createdAt)}</span>
                  </div>
                  <p>{auditLog.note ?? "No note was stored for this audit event."}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
