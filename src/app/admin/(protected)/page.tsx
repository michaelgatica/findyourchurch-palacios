import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatDateTime } from "@/lib/formatting";
import { listChurchesFromFirebase } from "@/lib/repositories/firebase-church-repository";
import {
  getClaimDashboardCounts,
  listAdminClaimRequests,
} from "@/lib/services/admin-claim-review-service";
import {
  getUpdateDashboardCounts,
  listAdminUpdateRequests,
} from "@/lib/services/admin-update-review-service";
import {
  getSubmissionDashboardCounts,
  listAdminSubmissions,
} from "@/lib/services/admin-submission-service";

export default async function AdminDashboardPage() {
  const [
    submissionCounts,
    claimCounts,
    updateCounts,
    recentSubmissions,
    recentClaimRequests,
    recentUpdateRequests,
    churches,
  ] = await Promise.all([
    getSubmissionDashboardCounts(),
    getClaimDashboardCounts(),
    getUpdateDashboardCounts(),
    listAdminSubmissions().then((records) => records.slice(0, 5)),
    listAdminClaimRequests().then((records) => records.slice(0, 5)),
    listAdminUpdateRequests().then((records) => records.slice(0, 5)),
    listChurchesFromFirebase(),
  ]);
  const publishedChurchCount = churches.filter((church) => church.status === "published").length;

  return (
    <div className="admin-content">
      <div className="admin-summary-grid">
        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Pending submissions</p>
          <strong>{submissionCounts.pendingReview}</strong>
          <span>Church listings waiting for review</span>
        </div>

        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Published churches</p>
          <strong>{publishedChurchCount}</strong>
          <span>Churches visible in the public directory</span>
        </div>

        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Denied submissions</p>
          <strong>{submissionCounts.denied}</strong>
          <span>Listings that were not approved</span>
        </div>

        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Changes requested</p>
          <strong>{submissionCounts.changesRequested}</strong>
          <span>Listings waiting on clarification</span>
        </div>

        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Pending claims</p>
          <strong>{claimCounts.pendingReview}</strong>
          <span>Ownership requests waiting for review</span>
        </div>

        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Pending updates</p>
          <strong>{updateCounts.pendingReview}</strong>
          <span>Representative listing changes waiting for review</span>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Admin focus</p>
        <h2>What needs attention first</h2>
        <p className="supporting-text">
          Start with pending submissions, pending claim requests, and pending representative
          updates. If all three are clear, check recent approvals, follow-up messages, and church
          representative assignments.
        </p>
      </div>

      <div className="admin-three-column">
        <div className="panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Recent submissions</p>
              <h2>Latest church listings</h2>
            </div>
            <Link href="/admin/submissions" className="button button--ghost">
              View queue
            </Link>
          </div>

          {recentSubmissions.length === 0 ? (
            <p className="supporting-text">No church submissions are in Firestore yet.</p>
          ) : (
            <div className="admin-list">
              {recentSubmissions.map((submission) => (
                <Link
                  key={submission.id}
                  href={`/admin/submissions/${submission.id}`}
                  className="admin-list__item"
                >
                  <div>
                    <h3>{submission.churchDraft.name}</h3>
                    <p className="supporting-text">
                      {submission.submitterName} - {formatDateTime(submission.createdAt)}
                    </p>
                  </div>
                  <AdminStatusBadge status={submission.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Recent claims</p>
              <h2>Latest ownership requests</h2>
            </div>
            <Link href="/admin/claims" className="button button--ghost">
              Review claims
            </Link>
          </div>

          {recentClaimRequests.length === 0 ? (
            <p className="supporting-text">No church claim requests are waiting yet.</p>
          ) : (
            <div className="admin-list">
              {recentClaimRequests.map((claimRequest) => (
                <Link
                  key={claimRequest.id}
                  href={`/admin/claims/${claimRequest.id}`}
                  className="admin-list__item"
                >
                  <div>
                    <h3>{claimRequest.requesterName}</h3>
                    <p className="supporting-text">
                      {claimRequest.requesterRoleTitle} - {formatDateTime(claimRequest.createdAt)}
                    </p>
                  </div>
                  <AdminStatusBadge status={claimRequest.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Recent updates</p>
              <h2>Latest representative changes</h2>
            </div>
            <Link href="/admin/updates" className="button button--ghost">
              Review updates
            </Link>
          </div>

          {recentUpdateRequests.length === 0 ? (
            <p className="supporting-text">No representative update requests are waiting yet.</p>
          ) : (
            <div className="admin-list">
              {recentUpdateRequests.map((updateRequest) => (
                <Link
                  key={updateRequest.id}
                  href={`/admin/updates/${updateRequest.id}`}
                  className="admin-list__item"
                >
                  <div>
                    <h3>{updateRequest.proposedChanges.name}</h3>
                    <p className="supporting-text">{formatDateTime(updateRequest.createdAt)}</p>
                  </div>
                  <AdminStatusBadge status={updateRequest.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow">Quick links</p>
            <h2>Review queues</h2>
          </div>
        </div>

        <div className="button-row">
          <Link href="/admin/submissions?status=pending_review" className="button button--primary">
            Pending submissions
          </Link>
          <Link href="/admin/submissions?status=changes_requested" className="button button--ghost">
            Changes requested
          </Link>
          <Link href="/admin/claims?status=pending_review" className="button button--secondary">
            Pending claims
          </Link>
          <Link href="/admin/updates?status=pending_review" className="button button--ghost">
            Pending updates
          </Link>
          <Link href="/admin/churches" className="button button--ghost">
            View churches
          </Link>
        </div>
      </div>
    </div>
  );
}
