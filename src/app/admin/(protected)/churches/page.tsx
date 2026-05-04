import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { buildChurchProfilePath } from "@/lib/config/site";
import { formatDate, formatDateTime } from "@/lib/formatting";
import { listChurchesFromFirebase } from "@/lib/repositories/firebase-church-repository";

export default async function AdminChurchesPage() {
  const churches = await listChurchesFromFirebase();

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Published and managed churches</p>
        <h1>Church records in Firestore</h1>
        <p className="supporting-text">
          Approved submissions create or update records in the <code>churches</code> collection.
          Claim approvals connect a primary representative to the church record, and the portal can
          now manage edits, team access, and update review.
        </p>
      </div>

      <div className="admin-card-list">
        {churches.length === 0 ? (
          <div className="panel">
            <h2>No churches are in Firestore yet</h2>
            <p className="supporting-text">
              Approve a submission or seed your churches collection to populate the admin church
              records page.
            </p>
          </div>
        ) : (
          churches.map((church) => (
            <div key={church.id} className="panel admin-card-list__item">
              <div className="admin-card-list__header">
                <div>
                  <h2>{church.name}</h2>
                  <p className="supporting-text">
                    {church.address.city}, {church.address.stateCode} - {church.denomination}
                  </p>
                </div>
                <AdminStatusBadge status={church.status} />
              </div>

              <div className="admin-metadata-grid">
                <div>
                  <strong>Primary representative</strong>
                  <p>{church.primaryRepresentativeId ?? "Not yet assigned"}</p>
                </div>
                <div>
                  <strong>Update mode</strong>
                  <p>{church.autoPublishUpdates ? "Auto publish" : "Admin review"}</p>
                </div>
                <div>
                  <strong>Updated</strong>
                  <p>{formatDateTime(church.updatedAt)}</p>
                </div>
                <div>
                  <strong>Last verified</strong>
                  <p>{formatDate(church.lastVerifiedAt)}</p>
                </div>
                <div>
                  <strong>Public profile</strong>
                  <p>{buildChurchProfilePath(church)}</p>
                </div>
              </div>

              <div className="button-row">
                <Link href={buildChurchProfilePath(church)} className="button button--ghost">
                  View public page
                </Link>
                <Link
                  href={`/admin/churches/${church.id}/representatives`}
                  className="button button--primary"
                >
                  Manage representatives
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
