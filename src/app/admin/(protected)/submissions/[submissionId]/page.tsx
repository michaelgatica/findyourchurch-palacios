import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  approveSubmissionAction,
  denySubmissionAction,
  requestSubmissionChangesAction,
  saveSubmissionInternalNoteAction,
  sendSubmissionPublicMessageAction,
} from "@/lib/actions/admin-review";
import { buildChurchProfilePath } from "@/lib/config/site";
import {
  formatBooleanLabel,
  formatDate,
  formatDateTime,
  formatListValue,
} from "@/lib/formatting";
import { getAdminSubmissionReviewData } from "@/lib/services/admin-submission-service";

interface AdminSubmissionDetailPageProps {
  params: Promise<{
    submissionId: string;
  }>;
}

export default async function AdminSubmissionDetailPage({
  params,
}: AdminSubmissionDetailPageProps) {
  const resolvedParams = await params;
  const reviewData = await getAdminSubmissionReviewData(resolvedParams.submissionId);

  if (!reviewData) {
    notFound();
  }

  const { submission, messages, auditLogs, emailLogs } = reviewData;
  const redirectTo = `/admin/submissions/${submission.id}`;

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Submission Review</p>
            <h1>{submission.churchDraft.name}</h1>
            <p className="supporting-text">
              Submitted by {submission.submitterName} on{" "}
              {formatDateTime(submission.submittedAt ?? submission.createdAt)}.
            </p>
          </div>

          <AdminStatusBadge status={submission.status} />
        </div>

        <div className="button-row">
          <Link href="/admin/submissions" className="button button--ghost">
            Back to submissions
          </Link>
          <Link href="/churches" className="button button--ghost">
            View public directory
          </Link>
        </div>
      </div>

      <div className="admin-review-grid">
        <div className="panel">
          <h2>Approve and publish</h2>
          <p className="supporting-text">
            Approving this submission creates or updates the church record in Firestore and makes
            it visible in the public directory.
          </p>
          <form action={approveSubmissionAction} className="field-stack">
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Optional admin note</span>
              <textarea
                name="adminMessage"
                placeholder="Optional note kept with the approval record"
              />
            </label>
            <button type="submit" className="button button--primary">
              Approve and publish
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Request changes</h2>
          <p className="supporting-text">
            This sends a public message to the submitter and keeps the listing out of the public
            directory until a new or corrected request is received.
          </p>
          <form action={requestSubmissionChangesAction} className="field-stack">
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Message to submitter</span>
              <textarea
                name="adminMessage"
                placeholder="Please explain what needs to be updated before publication."
                required
              />
            </label>
            <button type="submit" className="button button--secondary">
              Request changes
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Deny submission</h2>
          <p className="supporting-text">
            Denials require a message so the submitter understands why the listing was not
            published.
          </p>
          <form action={denySubmissionAction} className="field-stack">
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Message to submitter</span>
              <textarea
                name="adminMessage"
                placeholder="Share the reason this submission cannot be published."
                required
              />
            </label>
            <button type="submit" className="button button--ghost">
              Deny submission
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Save internal note</h2>
          <form action={saveSubmissionInternalNoteAction} className="field-stack">
            <input type="hidden" name="submissionId" value={submission.id} />
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
          <h2>Send message to submitter</h2>
          <form action={sendSubmissionPublicMessageAction} className="field-stack">
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Public message</span>
              <textarea
                name="messageBody"
                placeholder="This message is emailed to the submitter and stored in Firestore."
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
          <h2>Submitted church listing</h2>
          <div className="admin-detail-grid">
            <div>
              <strong>Address</strong>
              <p>
                {submission.churchDraft.address.line1}
                {submission.churchDraft.address.line2
                  ? `, ${submission.churchDraft.address.line2}`
                  : ""}
                <br />
                {submission.churchDraft.address.city}, {submission.churchDraft.address.stateCode}{" "}
                {submission.churchDraft.address.postalCode}
              </p>
            </div>
            <div>
              <strong>Pastor / clergy</strong>
              <p>{submission.churchDraft.primaryClergyName ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Additional leaders</strong>
              <p>{formatListValue(submission.churchDraft.additionalLeaders)}</p>
            </div>
            <div>
              <strong>Specific affiliation</strong>
              <p>{submission.churchDraft.specificAffiliation ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Description</strong>
              <p>{submission.churchDraft.description}</p>
            </div>
            <div>
              <strong>Statement of faith</strong>
              <p>{submission.churchDraft.statementOfFaith ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Service times</strong>
              <p>{submission.churchDraft.serviceTimes.map((serviceTime) => serviceTime.label).join(", ")}</p>
            </div>
            <div>
              <strong>Languages</strong>
              <p>{formatListValue(submission.churchDraft.languages)}</p>
            </div>
            <div>
              <strong>Worship style</strong>
              <p>{submission.churchDraft.worshipStyle ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Ministry tags</strong>
              <p>{submission.churchDraft.ministryTags.map((tag) => tag.label).join(", ") || "Not provided"}</p>
            </div>
            <div>
              <strong>Children&apos;s ministry</strong>
              <p>{formatBooleanLabel(submission.churchDraft.features.childrenMinistry)}</p>
            </div>
            <div>
              <strong>Youth ministry</strong>
              <p>{formatBooleanLabel(submission.churchDraft.features.youthMinistry)}</p>
            </div>
            <div>
              <strong>Nursery care</strong>
              <p>{formatBooleanLabel(submission.churchDraft.features.nurseryCare)}</p>
            </div>
            <div>
              <strong>Spanish service</strong>
              <p>{formatBooleanLabel(submission.churchDraft.features.spanishService)}</p>
            </div>
            <div>
              <strong>Livestream</strong>
              <p>{formatBooleanLabel(submission.churchDraft.features.livestream)}</p>
            </div>
            <div>
              <strong>Wheelchair accessible</strong>
              <p>{formatBooleanLabel(submission.churchDraft.features.wheelchairAccessible)}</p>
            </div>
            <div>
              <strong>Accessibility details</strong>
              <p>{submission.churchDraft.accessibilityDetails ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Visitor parking</strong>
              <p>{submission.churchDraft.visitorParkingDetails ?? "Not provided"}</p>
            </div>
            <div>
              <strong>First-time visitor notes</strong>
              <p>{submission.churchDraft.firstTimeVisitorNotes ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Website</strong>
              <p>{submission.churchDraft.website ?? "Not provided"}</p>
            </div>
            <div>
              <strong>Phone / email</strong>
              <p>
                {submission.churchDraft.phone}
                <br />
                {submission.churchDraft.email}
              </p>
            </div>
          </div>
        </div>

        <div className="admin-sidebar-stack">
          <div className="panel">
            <h2>Submitter details</h2>
            <div className="detail-list">
              <div className="detail-row">
                <dt>Name</dt>
                <dd>{submission.submitterName}</dd>
              </div>
              <div className="detail-row">
                <dt>Email</dt>
                <dd>{submission.submitterEmail}</dd>
              </div>
              <div className="detail-row">
                <dt>Phone</dt>
                <dd>{submission.submitterPhone ?? "Not provided"}</dd>
              </div>
              <div className="detail-row">
                <dt>Role / title</dt>
                <dd>{submission.submitterRole}</dd>
              </div>
              <div className="detail-row">
                <dt>Status</dt>
                <dd>{submission.status.replace(/_/g, " ")}</dd>
              </div>
              <div className="detail-row">
                <dt>Approved at</dt>
                <dd>{formatDateTime(submission.approvedAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Denied at</dt>
                <dd>{formatDateTime(submission.deniedAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Changes requested at</dt>
                <dd>{formatDateTime(submission.requestedChangesAt)}</dd>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Uploads</h2>
            {submission.churchDraft.logoSrc ? (
              <div className="admin-media-card">
                <Image
                  src={submission.churchDraft.logoSrc}
                  alt={`${submission.churchDraft.name} logo`}
                  width={160}
                  height={160}
                  className="admin-media-card__image admin-media-card__image--square"
                />
              </div>
            ) : (
              <p className="supporting-text">No logo was uploaded with this submission.</p>
            )}

            {submission.churchDraft.photos.length > 0 ? (
              <div className="admin-media-grid">
                {submission.churchDraft.photos.map((photo) => (
                  <Image
                    key={photo.id}
                    src={photo.src}
                    alt={photo.alt}
                    width={360}
                    height={240}
                    className="admin-media-card__image"
                  />
                ))}
              </div>
            ) : null}
          </div>

          {submission.status === "approved" ? (
            <div className="panel panel--gold-tint">
              <h2>Public listing</h2>
              <p className="supporting-text">
                Once approved, this church appears in the public directory at the profile below.
              </p>
              <Link
                href={buildChurchProfilePath(submission.slug)}
                className="button button--primary"
              >
                Open public profile
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="admin-three-column">
        <div className="panel">
          <h2>Messages</h2>
          {messages.length === 0 ? (
            <p className="supporting-text">No messages have been stored for this submission yet.</p>
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
