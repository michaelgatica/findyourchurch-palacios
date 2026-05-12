import Image from "next/image";
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
import type { ChurchListingDraft, ChurchPhoto, ChurchRecord } from "@/lib/types/directory";

interface AdminUpdateReviewPageProps {
  params: Promise<{
    updateRequestId: string;
  }>;
}

function formatList(values?: string[] | null) {
  return values && values.length > 0 ? values.join(", ") : "Not listed";
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatAddress(church: ChurchListingDraft | ChurchRecord) {
  return [
    church.address.line1,
    church.address.line2,
    `${church.address.city}, ${church.address.stateCode} ${church.address.postalCode}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatFeatures(church: ChurchListingDraft | ChurchRecord) {
  return [
    `Children: ${formatBoolean(church.features.childrenMinistry)}`,
    `Youth: ${formatBoolean(church.features.youthMinistry)}`,
    `Nursery: ${formatBoolean(church.features.nurseryCare)}`,
    `Spanish service: ${formatBoolean(church.features.spanishService)}`,
    `Livestream: ${formatBoolean(church.features.livestream)}`,
    `Wheelchair accessible: ${formatBoolean(church.features.wheelchairAccessible)}`,
  ].join(" | ");
}

function formatSocialLinks(church: ChurchListingDraft | ChurchRecord) {
  const links = [
    church.socialLinks.facebook ? `Facebook: ${church.socialLinks.facebook}` : null,
    church.socialLinks.instagram ? `Instagram: ${church.socialLinks.instagram}` : null,
    church.socialLinks.youtube ? `YouTube: ${church.socialLinks.youtube}` : null,
  ].filter(Boolean);

  return links.length > 0 ? links.join("\n") : "Not listed";
}

function formatServiceTimes(church: ChurchListingDraft | ChurchRecord) {
  return church.serviceTimes.length > 0
    ? church.serviceTimes.map((serviceTime) => serviceTime.label).join("\n")
    : "Not listed";
}

function formatMinistryTags(church: ChurchListingDraft | ChurchRecord) {
  return church.ministryTags.length > 0
    ? church.ministryTags.map((tag) => tag.label).join(", ")
    : "Not listed";
}

function normalizeCompareValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function ComparisonRow(props: {
  label: string;
  currentValue: string;
  proposedValue: string;
}) {
  const isChanged =
    normalizeCompareValue(props.currentValue) !== normalizeCompareValue(props.proposedValue);

  return (
    <div className={isChanged ? "admin-update-row admin-update-row--changed" : "admin-update-row"}>
      <div>
        <span className="admin-update-row__label">{props.label}</span>
        {isChanged ? <span className="status-badge">Changed</span> : null}
      </div>
      <div className="admin-update-row__value">
        <strong>Current</strong>
        <p>{props.currentValue}</p>
      </div>
      <div className="admin-update-row__value">
        <strong>Proposed</strong>
        <p>{props.proposedValue}</p>
      </div>
    </div>
  );
}

function canRenderImage(src?: string | null) {
  return Boolean(src && (src.startsWith("/") || src.startsWith("http://") || src.startsWith("https://")));
}

function AdminMediaImage(props: {
  src?: string | null;
  alt: string;
  isLogo?: boolean;
}) {
  if (!props.src) {
    return <p className="supporting-text">No image listed.</p>;
  }

  if (!canRenderImage(props.src)) {
    return <code>{props.src}</code>;
  }

  return (
    <Image
      src={props.src}
      alt={props.alt}
      width={props.isLogo ? 120 : 220}
      height={props.isLogo ? 120 : 150}
      className={
        props.isLogo
          ? "admin-update-media__image admin-update-media__image--logo"
          : "admin-update-media__image"
      }
    />
  );
}

function MediaGallery(props: {
  title: string;
  logoSrc?: string | null;
  photos: ChurchPhoto[];
}) {
  return (
    <div className="panel admin-update-media">
      <h3>{props.title}</h3>
      <div className="admin-update-media__logo">
        <span className="church-card__label">Logo</span>
        <AdminMediaImage src={props.logoSrc} alt={`${props.title} logo`} isLogo />
      </div>
      <div>
        <span className="church-card__label">Photos</span>
        {props.photos.length > 0 ? (
          <div className="admin-update-media__grid">
            {props.photos.map((photo) => (
              <figure key={photo.id} className="admin-update-media__item">
                <AdminMediaImage src={photo.src} alt={photo.alt} />
                <figcaption>{photo.alt}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="supporting-text">No photos listed.</p>
        )}
      </div>
    </div>
  );
}

function ListingUpdateComparison(props: {
  church: ChurchRecord;
  proposedChanges: ChurchListingDraft;
}) {
  const { church, proposedChanges } = props;
  const rows = [
    ["Church name", church.name, proposedChanges.name],
    ["Custom share link", church.customShareSlug ?? "Not listed", proposedChanges.customShareSlug ?? "Not listed"],
    ["Address", formatAddress(church), formatAddress(proposedChanges)],
    ["Phone", church.phone, proposedChanges.phone],
    ["Email", church.email ?? "Not listed", proposedChanges.email ?? "Not listed"],
    ["Website", church.website ?? "Not listed", proposedChanges.website ?? "Not listed"],
    ["Social links", formatSocialLinks(church), formatSocialLinks(proposedChanges)],
    ["Denomination / tradition", church.denomination, proposedChanges.denomination],
    ["Specific affiliation", church.specificAffiliation ?? "Not listed", proposedChanges.specificAffiliation ?? "Not listed"],
    [
      church.clergyLabel ?? "Pastor / Priest / Reverend",
      church.primaryClergyName ?? "Not listed",
      proposedChanges.primaryClergyName ?? "Not listed",
    ],
    ["Additional clergy / leaders", formatList(church.additionalLeaders), formatList(proposedChanges.additionalLeaders)],
    ["Description", church.description, proposedChanges.description],
    ["Statement of faith", church.statementOfFaith ?? "Not listed", proposedChanges.statementOfFaith ?? "Not listed"],
    ["Service times", formatServiceTimes(church), formatServiceTimes(proposedChanges)],
    ["Worship style", church.worshipStyle ?? "Not listed", proposedChanges.worshipStyle ?? "Not listed"],
    ["Languages", formatList(church.languages), formatList(proposedChanges.languages)],
    ["Ministry tags", formatMinistryTags(church), formatMinistryTags(proposedChanges)],
    ["Feature checklist", formatFeatures(church), formatFeatures(proposedChanges)],
    ["Visitor parking", church.visitorParkingDetails ?? "Not listed", proposedChanges.visitorParkingDetails ?? "Not listed"],
    ["First-time visitor notes", church.firstTimeVisitorNotes ?? "Not listed", proposedChanges.firstTimeVisitorNotes ?? "Not listed"],
    ["Accessibility details", church.accessibilityDetails ?? "Not listed", proposedChanges.accessibilityDetails ?? "Not listed"],
    ["Online giving", church.onlineGivingUrl ?? "Not listed", proposedChanges.onlineGivingUrl ?? "Not listed"],
  ] satisfies Array<[string, string, string]>;

  return (
    <div className="panel admin-update-comparison">
      <div className="admin-panel__header">
        <div>
          <p className="eyebrow eyebrow--gold">Full Listing Review</p>
          <h2>Current listing vs proposed update</h2>
          <p className="supporting-text">
            Changed rows are highlighted so media, contact details, service times, and ministry
            details can be reviewed before approval.
          </p>
        </div>
      </div>

      <div className="admin-update-comparison__rows">
        {rows.map(([label, currentValue, proposedValue]) => (
          <ComparisonRow
            key={label}
            label={label}
            currentValue={currentValue}
            proposedValue={proposedValue}
          />
        ))}
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

      <ListingUpdateComparison
        church={reviewData.church}
        proposedChanges={reviewData.updateRequest.proposedChanges}
      />

      <div className="admin-review-grid">
        <MediaGallery
          title="Current media"
          logoSrc={reviewData.church.logoSrc}
          photos={reviewData.church.photos}
        />
        <MediaGallery
          title="Proposed media"
          logoSrc={reviewData.updateRequest.proposedChanges.logoSrc}
          photos={reviewData.updateRequest.proposedChanges.photos}
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
