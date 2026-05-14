import Link from "next/link";

import { formatDateTime } from "@/lib/formatting";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getRepresentativeUpdateActivity } from "@/lib/services/church-update-service";

interface PortalUpdatesPageProps {
  searchParams: Promise<{
    success?: string;
  }>;
}

export default async function PortalUpdatesPage({ searchParams }: PortalUpdatesPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church) {
    return null;
  }

  const updates = await getRepresentativeUpdateActivity(context.church.id);

  return (
    <div className="admin-content">
      {resolvedSearchParams.success ? (
        <div className="form-alert form-alert--success">
          Your updates have been submitted for review. Please allow up to 24 hours for approval.
        </div>
      ) : null}

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Listing Update History</p>
        <h1>Representative changes</h1>
        <p className="supporting-text">
          This page shows whether your updates published immediately or were routed to admin for
          review.
        </p>
      </div>

      <div className="panel">
        {updates.length === 0 ? (
          <p className="supporting-text">No listing update activity has been recorded yet.</p>
        ) : (
          <div className="timeline">
            {updates.map((updateRequest) => (
              <div key={updateRequest.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{updateRequest.status.replace(/_/g, " ")}</span>
                  <span>{formatDateTime(updateRequest.createdAt)}</span>
                </div>
                <p>
                  {updateRequest.autoPublished
                    ? "Changes were auto-published on the public listing."
                    : "Changes were submitted to the admin review queue."}
                </p>
                {updateRequest.adminMessage ? <p>{updateRequest.adminMessage}</p> : null}
                {updateRequest.status === "changes_requested" ? (
                  <Link href="/portal/church/edit" className="button button--ghost">
                    Edit requested changes
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
