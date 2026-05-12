import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatDateTime } from "@/lib/formatting";
import {
  getClaimDashboardCounts,
  listAdminClaimRequests,
} from "@/lib/services/admin-claim-review-service";
import { churchClaimRequestStatuses, type ChurchClaimRequestRecord } from "@/lib/types/directory";

function getClaimAuthorizationSummary(claimRequest: ChurchClaimRequestRecord) {
  return (
    claimRequest.authorizationExplanation ??
    claimRequest.proofOrExplanation ??
    claimRequest.relationshipToChurch ??
    "Not provided"
  );
}

interface AdminClaimsPageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

export default async function AdminClaimsPage({ searchParams }: AdminClaimsPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeStatus = churchClaimRequestStatuses.includes(
    resolvedSearchParams.status as (typeof churchClaimRequestStatuses)[number],
  )
    ? resolvedSearchParams.status
    : undefined;
  const [counts, claimRequests] = await Promise.all([
    getClaimDashboardCounts(),
    listAdminClaimRequests(activeStatus),
  ]);

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Church Claims</p>
            <h1>Review listing ownership requests</h1>
            <p className="supporting-text">
              Approved claims establish the primary church representative in Firestore so the
              church can use the representative portal and keep its listing current.
            </p>
          </div>
        </div>

        <div className="status-filter-row">
          <Link
            href="/admin/claims"
            className={!activeStatus ? "button button--secondary" : "button button--ghost"}
          >
            All
          </Link>
          {churchClaimRequestStatuses.map((status) => (
            <Link
              key={status}
              href={`/admin/claims?status=${status}`}
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
          <span>More info requested: {counts.moreInfoRequested}</span>
        </div>
      </div>

      <div className="admin-card-list">
        {claimRequests.length === 0 ? (
          <div className="panel">
            <h2>No claim requests matched this filter</h2>
            <p className="supporting-text">
              New requests will appear here after a user submits a church access request.
            </p>
          </div>
        ) : (
          claimRequests.map((claimRequest) => (
            <div key={claimRequest.id} className="panel admin-card-list__item">
              <div className="admin-card-list__header">
                <div>
                  <h2>{claimRequest.requesterName}</h2>
                  <p className="supporting-text">
                    {claimRequest.requesterRoleTitle} - {claimRequest.requesterEmail}
                  </p>
                </div>
                <AdminStatusBadge status={claimRequest.status} />
              </div>

              <div className="admin-metadata-grid">
                <div>
                  <strong>Church ID</strong>
                  <p>{claimRequest.churchId}</p>
                </div>
                <div>
                  <strong>Authorization</strong>
                  <p>{getClaimAuthorizationSummary(claimRequest)}</p>
                </div>
                <div>
                  <strong>Requested</strong>
                  <p>{formatDateTime(claimRequest.createdAt)}</p>
                </div>
                <div>
                  <strong>Reviewed</strong>
                  <p>{formatDateTime(claimRequest.reviewedAt)}</p>
                </div>
              </div>

              <div className="button-row">
                <Link href={`/admin/claims/${claimRequest.id}`} className="button button--primary">
                  Review claim request
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
