import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatDateTime } from "@/lib/formatting";
import {
  getSubmissionDashboardCounts,
  listAdminSubmissions,
} from "@/lib/services/admin-submission-service";
import { churchSubmissionStatuses } from "@/lib/types/directory";

interface AdminSubmissionsPageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

export default async function AdminSubmissionsPage({
  searchParams,
}: AdminSubmissionsPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeStatus = churchSubmissionStatuses.includes(
    resolvedSearchParams.status as (typeof churchSubmissionStatuses)[number],
  )
    ? resolvedSearchParams.status
    : undefined;
  const [counts, submissions] = await Promise.all([
    getSubmissionDashboardCounts(),
    listAdminSubmissions(activeStatus),
  ]);

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Church Submissions</p>
            <h1>Review church listing requests</h1>
            <p className="supporting-text">
              New public submissions stay in <strong>pending_review</strong> until an admin
              approves, denies, or requests changes.
            </p>
          </div>
        </div>

        <div className="status-filter-row">
          <Link
            href="/admin/submissions"
            className={!activeStatus ? "button button--secondary" : "button button--ghost"}
          >
            All
          </Link>
          {churchSubmissionStatuses.map((status) => (
            <Link
              key={status}
              href={`/admin/submissions?status=${status}`}
              className={activeStatus === status ? "button button--secondary" : "button button--ghost"}
            >
              {status.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        <div className="admin-inline-stats">
          <span>Pending: {counts.pendingReview}</span>
          <span>Approved: {counts.approved}</span>
          <span>Denied: {counts.denied}</span>
          <span>Changes requested: {counts.changesRequested}</span>
        </div>
      </div>

      <div className="admin-card-list">
        {submissions.length === 0 ? (
          <div className="panel">
            <h2>No submissions matched this filter</h2>
            <p className="supporting-text">
              Try another status, or return later when new churches have been submitted.
            </p>
          </div>
        ) : (
          submissions.map((submission) => (
            <div key={submission.id} className="panel admin-card-list__item">
              <div className="admin-card-list__header">
                <div>
                  <h2>{submission.churchDraft.name}</h2>
                  <p className="supporting-text">
                    {submission.churchDraft.address.city}, {submission.churchDraft.address.stateCode} -{" "}
                    {submission.churchDraft.denomination}
                  </p>
                </div>
                <AdminStatusBadge status={submission.status} />
              </div>

              <div className="admin-metadata-grid">
                <div>
                  <strong>Submitter</strong>
                  <p>{submission.submitterName}</p>
                </div>
                <div>
                  <strong>Email</strong>
                  <p>{submission.submitterEmail}</p>
                </div>
                <div>
                  <strong>Submitted</strong>
                  <p>{formatDateTime(submission.submittedAt ?? submission.createdAt)}</p>
                </div>
                <div>
                  <strong>Service times</strong>
                  <p>
                    {submission.churchDraft.serviceTimes
                      .map((serviceTime) => serviceTime.label)
                      .join(", ")}
                  </p>
                </div>
              </div>

              <div className="button-row">
                <Link
                  href={`/admin/submissions/${submission.id}`}
                  className="button button--primary"
                >
                  Review submission
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
