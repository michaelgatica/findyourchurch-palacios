import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatDateTime } from "@/lib/formatting";
import {
  getUpdateDashboardCounts,
  listAdminUpdateRequests,
} from "@/lib/services/admin-update-review-service";
import { churchUpdateRequestStatuses } from "@/lib/types/directory";

interface AdminUpdatesPageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

export default async function AdminUpdatesPage({ searchParams }: AdminUpdatesPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeStatus = churchUpdateRequestStatuses.includes(
    resolvedSearchParams.status as (typeof churchUpdateRequestStatuses)[number],
  )
    ? resolvedSearchParams.status
    : undefined;
  const [counts, updateRequests] = await Promise.all([
    getUpdateDashboardCounts(),
    listAdminUpdateRequests(activeStatus),
  ]);

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Representative Updates</p>
            <h1>Review church listing changes</h1>
            <p className="supporting-text">
              Churches with <strong>autoPublishUpdates</strong> disabled send representative
              changes here for review before the public listing changes.
            </p>
          </div>
        </div>

        <div className="status-filter-row">
          <Link
            href="/admin/updates"
            className={!activeStatus ? "button button--secondary" : "button button--ghost"}
          >
            All
          </Link>
          {churchUpdateRequestStatuses.map((status) => (
            <Link
              key={status}
              href={`/admin/updates?status=${status}`}
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
        {updateRequests.length === 0 ? (
          <div className="panel">
            <h2>No update requests matched this filter</h2>
            <p className="supporting-text">
              Representative-submitted church changes will appear here when review is needed. If a
              church is set to auto-publish, its updates can still be tracked from the church
              record and audit logs.
            </p>
          </div>
        ) : (
          updateRequests.map((updateRequest) => (
            <div key={updateRequest.id} className="panel admin-card-list__item">
              <div className="admin-card-list__header">
                <div>
                  <h2>{updateRequest.proposedChanges.name}</h2>
                  <p className="supporting-text">
                    {updateRequest.proposedChanges.address.city}, {updateRequest.proposedChanges.address.stateCode}
                  </p>
                </div>
                <AdminStatusBadge status={updateRequest.status} />
              </div>

              <div className="admin-metadata-grid">
                <div>
                  <strong>Church ID</strong>
                  <p>{updateRequest.churchId}</p>
                </div>
                <div>
                  <strong>Submitted</strong>
                  <p>{formatDateTime(updateRequest.createdAt)}</p>
                </div>
                <div>
                  <strong>Auto published</strong>
                  <p>{updateRequest.autoPublished ? "Yes" : "No"}</p>
                </div>
                <div>
                  <strong>Service times</strong>
                  <p>{updateRequest.proposedChanges.serviceTimes.map((serviceTime) => serviceTime.label).join(", ")}</p>
                </div>
              </div>

              <div className="button-row">
                <Link href={`/admin/updates/${updateRequest.id}`} className="button button--primary">
                  Review update request
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
