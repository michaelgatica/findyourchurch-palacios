import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  approveUpdateRequestAction,
  denyUpdateRequestAction,
  requestUpdateChangesAction,
  saveUpdateInternalNoteAction,
  sendUpdatePublicMessageAction,
} from "@/lib/actions/admin-review";
import { formatDateTime } from "@/lib/formatting";
import { getAdminUpdateReviewData } from "@/lib/services/admin-update-review-service";

interface AdminUpdateReviewPageProps {
  params: Promise<{
    updateRequestId: string;
  }>;
}

function DraftSummary(props: {
  title: string;
  description: string;
  serviceTimes: string[];
  languages: string[];
}) {
  return (
    <div className="panel">
      <h2>{props.title}</h2>
      <p>{props.description}</p>
      <div className="detail-list">
        <div className="detail-row">
          <dt>Service times</dt>
          <dd>{props.serviceTimes.join(", ")}</dd>
        </div>
        <div className="detail-row">
          <dt>Languages</dt>
          <dd>{props.languages.join(", ") || "Not listed"}</dd>
        </div>
      </div>
    </div>
  );
}

export default async function AdminUpdateReviewPage({ params }: AdminUpdateReviewPageProps) {
  const { updateRequestId } = await params;
  const reviewData = await getAdminUpdateReviewData(updateRequestId);

  if (!reviewData || !reviewData.church) {
    notFound();
  }

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Update Review</p>
            <h1>{reviewData.church.name}</h1>
            <p className="supporting-text">
              Submitted by {reviewData.submittedByUser?.name ?? reviewData.representative?.name ?? "Representative"} on{" "}
              {formatDateTime(reviewData.updateRequest.createdAt)}.
            </p>
          </div>
          <AdminStatusBadge status={reviewData.updateRequest.status} />
        </div>
      </div>

      <div className="admin-review-grid">
        <DraftSummary
          title="Current published listing"
          description={reviewData.church.description}
          serviceTimes={reviewData.church.serviceTimes.map((serviceTime) => serviceTime.label)}
          languages={reviewData.church.languages}
        />
        <DraftSummary
          title="Proposed changes"
          description={reviewData.updateRequest.proposedChanges.description}
          serviceTimes={reviewData.updateRequest.proposedChanges.serviceTimes.map((serviceTime) => serviceTime.label)}
          languages={reviewData.updateRequest.proposedChanges.languages}
        />
      </div>

      <div className="admin-two-column">
        <div className="panel">
          <h2>Review actions</h2>
          <div className="section-stack">
            <form action={approveUpdateRequestAction}>
              <input type="hidden" name="updateRequestId" value={reviewData.updateRequest.id} />
              <button type="submit" className="button button--primary">
                Approve update
              </button>
            </form>

            <form action={requestUpdateChangesAction} className="submission-form">
              <input type="hidden" name="updateRequestId" value={reviewData.updateRequest.id} />
              <label className="field field--full">
                <span className="field__label">Request changes</span>
                <textarea name="adminMessage" required />
              </label>
              <button type="submit" className="button button--secondary">
                Request changes
              </button>
            </form>

            <form action={denyUpdateRequestAction} className="submission-form">
              <input type="hidden" name="updateRequestId" value={reviewData.updateRequest.id} />
              <label className="field field--full">
                <span className="field__label">Deny update</span>
                <textarea name="adminMessage" required />
              </label>
              <button type="submit" className="button button--ghost">
                Deny update
              </button>
            </form>
          </div>
        </div>

        <div className="panel">
          <h2>Notes and messages</h2>
          <form action={saveUpdateInternalNoteAction} className="submission-form">
            <input type="hidden" name="updateRequestId" value={reviewData.updateRequest.id} />
            <label className="field field--full">
              <span className="field__label">Internal note</span>
              <textarea name="note" required />
            </label>
            <button type="submit" className="button button--secondary">
              Save internal note
            </button>
          </form>

          <form action={sendUpdatePublicMessageAction} className="submission-form">
            <input type="hidden" name="updateRequestId" value={reviewData.updateRequest.id} />
            <label className="field field--full">
              <span className="field__label">Public message to representative</span>
              <textarea name="messageBody" required />
            </label>
            <button type="submit" className="button button--ghost">
              Send message
            </button>
          </form>
        </div>
      </div>

      <div className="admin-three-column">
        <div className="panel">
          <h2>Messages</h2>
          <div className="timeline">
            {reviewData.messages.map((message) => (
              <div key={message.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{message.isInternal ? "Internal" : message.senderType}</span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p>{message.messageBody}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Audit log</h2>
          <div className="timeline">
            {reviewData.auditLogs.map((log) => (
              <div key={log.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{log.action.replace(/_/g, " ")}</span>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
                <p>{log.note ?? "No note recorded."}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Email log</h2>
          <div className="timeline">
            {reviewData.emailLogs.map((emailLog) => (
              <div key={emailLog.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{emailLog.subject}</span>
                  <span>{formatDateTime(emailLog.createdAt)}</span>
                </div>
                <p>{emailLog.bodyPreview}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="button-row">
        <Link href="/admin/updates" className="button button--ghost">
          Back to updates
        </Link>
      </div>
    </div>
  );
}
