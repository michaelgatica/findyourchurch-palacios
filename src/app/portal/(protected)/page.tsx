import Link from "next/link";

import { formatDate, formatDateTime } from "@/lib/formatting";
import { getPublicChurchMessageThread } from "@/lib/services/church-messaging-service";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { getRepresentativeUpdateActivity } from "@/lib/services/church-update-service";

interface PortalDashboardPageProps {
  searchParams: Promise<{
    success?: string;
  }>;
}

export default async function PortalDashboardPage({ searchParams }: PortalDashboardPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church || !context.representative) {
    return null;
  }

  const [messages, updateActivity] = await Promise.all([
    getPublicChurchMessageThread(context.church.id),
    getRepresentativeUpdateActivity(context.church.id),
  ]);
  const recentAdminMessages = messages
    .filter((message) => message.senderType === "admin")
    .slice(0, 3);

  return (
    <div className="admin-content">
      {resolvedSearchParams.success ? (
        <div className="form-alert form-alert--success">
          {resolvedSearchParams.success === "listing-updated"
            ? "Your church listing has been updated."
            : "Portal action completed successfully."}
        </div>
      ) : null}

      <div className="admin-summary-grid">
        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Listing status</p>
          <strong>{context.church.status.replace(/_/g, " ")}</strong>
          <span>Current public publication state</span>
        </div>
        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Last verified</p>
          <strong>{formatDate(context.church.lastVerifiedAt)}</strong>
          <span>Most recent verification date on file</span>
        </div>
        <div className="panel admin-stat-card">
          <p className="eyebrow eyebrow--gold">Update mode</p>
          <strong>{context.church.autoPublishUpdates ? "Auto publish" : "Admin review"}</strong>
          <span>
            {context.church.autoPublishUpdates
              ? "Changes publish immediately"
              : "Changes wait for admin approval"}
          </span>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">What to expect</p>
        <h2>How listing changes work</h2>
        <p className="supporting-text">
          If your church is set to auto-publish, approved representatives can update the public
          listing right away. If not, changes will be submitted for admin review and usually
          reviewed within 24 hours.
        </p>
      </div>

      <div className="panel">
        <div className="button-row">
          <Link href="/portal/church/edit" className="button button--primary">
            Edit listing
          </Link>
          <Link href="/portal/messages" className="button button--ghost">
            Messages
          </Link>
          <Link href="/portal/team" className="button button--ghost">
            Invite editor
          </Link>
          <Link href="/portal/transfer-ownership" className="button button--ghost">
            Transfer ownership
          </Link>
        </div>
      </div>

      <div className="admin-two-column">
        <div className="panel">
          <h2>Recent admin messages</h2>
          {recentAdminMessages.length === 0 ? (
            <p className="supporting-text">
              No public admin messages are on this listing yet. If you have a question, you can
              reach out from the Messages page.
            </p>
          ) : (
            <div className="timeline">
              {recentAdminMessages.map((message) => (
                <div key={message.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>Admin</span>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.messageBody}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Recent update activity</h2>
          {updateActivity.length === 0 ? (
            <p className="supporting-text">
              No listing updates have been submitted yet. When you edit the listing, the result
              will appear here.
            </p>
          ) : (
            <div className="timeline">
              {updateActivity.slice(0, 4).map((updateRequest) => (
                <div key={updateRequest.id} className="timeline-item">
                  <div className="timeline-item__meta">
                    <span>{updateRequest.status.replace(/_/g, " ")}</span>
                    <span>{formatDateTime(updateRequest.createdAt)}</span>
                  </div>
                  <p>
                    {updateRequest.autoPublished
                      ? "Listing changes were published automatically."
                      : "Listing changes were submitted for admin review."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
