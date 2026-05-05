import Link from "next/link";

import { buildChurchProfilePath, buildChurchSharePath, buildAbsoluteUrl } from "@/lib/config/site";
import { formatDate } from "@/lib/formatting";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

export default async function PortalChurchPage() {
  const context = await getRepresentativePortalContext();

  if (!context?.church) {
    return null;
  }

  const church = context.church;
  const customSharePath = buildChurchSharePath(church.customShareSlug);

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Current Listing</p>
        <h1>{church.name}</h1>
        <p className="supporting-text">
          This is the information currently visible to the public directory. Any approved portal
          edits will update what visitors see here.
        </p>
        <div className="button-row">
          <Link href="/portal/church/edit" className="button button--primary">
            Edit listing
          </Link>
          <Link href={buildChurchProfilePath(church)} className="button button--ghost">
            View public profile
          </Link>
        </div>
      </div>

      <div className="admin-review-grid">
        <div className="panel">
          <h2>About</h2>
          <p>{church.description}</p>
          <p className="supporting-text">{church.statementOfFaith ?? "No statement of faith is currently listed."}</p>
        </div>

        <div className="panel">
          <h2>Contact and location</h2>
          <div className="detail-list">
            <div className="detail-row">
              <dt>Address</dt>
              <dd>
                {church.address.line1}
                {church.address.line2 ? `, ${church.address.line2}` : ""}
                {`, ${church.address.city}, ${church.address.stateCode} ${church.address.postalCode}`}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Phone</dt>
              <dd>{church.phone || "Not listed yet"}</dd>
            </div>
            <div className="detail-row">
              <dt>Email</dt>
              <dd>{church.email ?? "Not listed yet"}</dd>
            </div>
            <div className="detail-row">
              <dt>Last verified</dt>
              <dd>{formatDate(church.lastVerifiedAt)}</dd>
            </div>
            <div className="detail-row">
              <dt>Update mode</dt>
              <dd>{church.autoPublishUpdates ? "Auto publish" : "Admin review required"}</dd>
            </div>
            <div className="detail-row">
              <dt>Custom share link</dt>
              <dd>
                {customSharePath ? (
                  <Link href={customSharePath} className="text-link">
                    {buildAbsoluteUrl(customSharePath)}
                  </Link>
                ) : (
                  "Not set yet"
                )}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
