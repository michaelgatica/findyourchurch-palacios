import Image from "next/image";
import Link from "next/link";

import {
  buildAbsoluteUrl,
  buildChurchClaimPath,
  buildChurchProfilePath,
} from "@/lib/config/site";
import {
  buildDirectionsUrl,
  formatAddress,
  getChurchInitials,
  getPrimaryServiceTime,
} from "@/lib/church-utils";
import { formatDate, formatListValue } from "@/lib/formatting";
import type { ChurchRecord } from "@/lib/types/directory";

function ExternalActionButton({
  href,
  label,
}: {
  href?: string;
  label: string;
}) {
  if (!href) {
    return (
      <span className="button button--ghost button--disabled" aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="button button--secondary"
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
    >
      {label}
    </Link>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BooleanFeature({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className={`feature-pill ${enabled ? "feature-pill--enabled" : "feature-pill--muted"}`}>
      {label}
    </div>
  );
}

export function ChurchProfileView({ church }: { church: ChurchRecord }) {
  const primaryServiceTime = getPrimaryServiceTime(church);
  const canonicalPath = buildChurchProfilePath(church);
  const claimPath = buildChurchClaimPath(church);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: church.name,
    description: church.description,
    url: buildAbsoluteUrl(canonicalPath),
    telephone: church.phone,
    email: church.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: church.address.line1,
      addressLocality: church.address.city,
      addressRegion: church.address.stateCode,
      postalCode: church.address.postalCode,
      addressCountry: church.address.countryCode,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="profile-hero">
        <div className="shell profile-hero__inner">
          <div className="profile-hero__identity">
            {church.logoSrc ? (
              <Image
                src={church.logoSrc}
                alt={`${church.name} logo`}
                width={112}
                height={112}
                className="profile-hero__logo-image"
              />
            ) : (
              <div className="profile-hero__logo-fallback" aria-hidden="true">
                {getChurchInitials(church.name)}
              </div>
            )}

            <div>
              <div className="profile-hero__badge-row">
                <span className="church-card__badge">{church.denomination}</span>
                {church.isSeedContent ? <p className="profile-hero__sample-note">Sample listing</p> : null}
              </div>
              <h1>{church.name}</h1>
              <p className="profile-hero__subtitle">
                {church.specificAffiliation ?? "Serving the Palacios area"}
              </p>
              <p className="profile-hero__service-time">
                {primaryServiceTime?.label ?? "Service times coming soon"}
              </p>
              <p className="profile-hero__address">{formatAddress(church.address)}</p>
              <div className="tag-row profile-hero__tag-row">
                {church.worshipStyle ? <span className="tag">{church.worshipStyle}</span> : null}
                {church.languages.length > 0 ? (
                  <span className="tag">{formatListValue(church.languages)}</span>
                ) : null}
                {church.features.childrenMinistry ? <span className="tag">Children&apos;s ministry</span> : null}
                {church.features.youthMinistry ? <span className="tag">Youth ministry</span> : null}
              </div>
            </div>
          </div>

          <div className="profile-hero__actions">
            <ExternalActionButton href={`tel:${church.phone.replace(/\s+/g, "")}`} label="Call" />
            <ExternalActionButton
              href={church.email ? `mailto:${church.email}` : undefined}
              label="Email"
            />
            <ExternalActionButton href={church.website} label="Visit Website" />
            <ExternalActionButton href={buildDirectionsUrl(church.address)} label="Get Directions" />
            <Link href={claimPath} className="button button--ghost profile-hero__claim-button">
              Claim This Church
            </Link>
          </div>
        </div>
      </section>

      <section className="shell profile-layout">
        <div className="profile-main">
          <div className="panel profile-summary-panel">
            <div className="profile-summary-grid">
              <div>
                <span className="church-card__label">Pastor / clergy</span>
                <p>{church.primaryClergyName ?? "Not listed"}</p>
              </div>
              <div>
                <span className="church-card__label">Denomination</span>
                <p>{church.denomination}</p>
              </div>
              <div>
                <span className="church-card__label">Worship style</span>
                <p>{church.worshipStyle ?? "Not listed"}</p>
              </div>
              <div>
                <span className="church-card__label">Last verified</span>
                <p>{formatDate(church.lastVerifiedAt)}</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">About</p>
            <h2>About this church</h2>
            <p>{church.description}</p>
            {church.statementOfFaith ? (
              <p className="supporting-text">
                <strong>Statement of faith:</strong> {church.statementOfFaith}
              </p>
            ) : null}
          </div>

          <div className="photo-gallery">
            {church.photos.length > 0 ? (
              church.photos.slice(0, 4).map((photo) => (
                <figure key={photo.id} className="photo-gallery__item">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={720}
                    height={480}
                    className="photo-gallery__image"
                  />
                  {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                </figure>
              ))
            ) : (
              <div className="panel photo-gallery__empty">
                <h3>Photos coming soon</h3>
                <p>This listing is published, and more visual details can be added in a later update.</p>
              </div>
            )}
          </div>

          <div className="panel">
            <p className="eyebrow">Service Times</p>
            <h2>Service times</h2>
            <div className="service-list">
              {church.serviceTimes.map((serviceTime) => (
                <div key={serviceTime.id} className="service-list__item">
                  <p>{serviceTime.label}</p>
                  {serviceTime.notes ? <span>{serviceTime.notes}</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Ministries</p>
            <h2>Ministry highlights</h2>
            <div className="feature-grid">
              <BooleanFeature enabled={church.features.childrenMinistry} label="Children's ministry" />
              <BooleanFeature enabled={church.features.youthMinistry} label="Youth ministry" />
              <BooleanFeature enabled={church.features.nurseryCare} label="Nursery care" />
              <BooleanFeature enabled={church.features.spanishService} label="Spanish service" />
              <BooleanFeature enabled={church.features.livestream} label="Livestream" />
              <BooleanFeature enabled={church.features.wheelchairAccessible} label="Wheelchair accessible" />
            </div>
            <div className="tag-row">
              {church.ministryTags.map((tag) => (
                <span key={tag.id} className="tag">
                  {tag.label}
                </span>
              ))}
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Visitor Information</p>
            <h2>Visitor information</h2>
            <div className="info-grid">
              <div>
                <h3>Parking</h3>
                <p>{church.visitorParkingDetails ?? "Parking details coming soon."}</p>
              </div>
              <div>
                <h3>First-time visitors</h3>
                <p>{church.firstTimeVisitorNotes ?? "Visitor notes coming soon."}</p>
              </div>
              <div>
                <h3>Accessibility</h3>
                <p>{church.accessibilityDetails ?? "Accessibility details coming soon."}</p>
              </div>
              <div>
                <h3>Livestream</h3>
                <p>
                  {church.livestreamDetails ??
                    (church.features.livestream
                      ? "Livestream information is available through the church."
                      : "No livestream is currently listed.")}
                </p>
              </div>
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Contact</p>
            <h2>Contact this church</h2>
            <dl className="detail-list">
              <DetailRow label="Address" value={formatAddress(church.address)} />
              <DetailRow label="Phone" value={church.phone} />
              <DetailRow label="Email" value={church.email} />
              <DetailRow label="Website" value={church.website} />
              <DetailRow label="Languages offered" value={formatListValue(church.languages)} />
              <DetailRow label="Last verified" value={formatDate(church.lastVerifiedAt)} />
            </dl>
          </div>
        </div>

        <aside className="profile-sidebar">
          <div className="panel">
            <p className="eyebrow">Church Details</p>
            <h2>Quick details</h2>
            <dl className="detail-list">
              <DetailRow label="Denomination / tradition" value={church.denomination} />
              <DetailRow label="Specific affiliation" value={church.specificAffiliation} />
              <DetailRow
                label={church.clergyLabel ?? "Pastor / priest / reverend"}
                value={church.primaryClergyName}
              />
              <DetailRow
                label="Additional clergy / leaders"
                value={church.additionalLeaders.join(", ")}
              />
              <DetailRow label="Worship style" value={church.worshipStyle} />
              <DetailRow
                label="Online giving"
                value={church.onlineGivingUrl ? "Available through listed website" : "Not listed"}
              />
            </dl>
          </div>

          <div className="panel claim-cta">
            <p className="eyebrow">Church Representatives</p>
            <h2>Claim This Church</h2>
            <p>
              Are you a pastor, staff member, or authorized representative? Request access to help
              keep this listing updated.
            </p>
            <Link href={claimPath} className="button button--ghost">
              Claim This Church
            </Link>
          </div>

          {(church.socialLinks.facebook || church.socialLinks.instagram || church.socialLinks.youtube) && (
            <div className="panel">
              <h2>Social links</h2>
              <div className="link-stack">
                {church.socialLinks.facebook ? (
                  <Link href={church.socialLinks.facebook} target="_blank" rel="noreferrer">
                    Facebook
                  </Link>
                ) : null}
                {church.socialLinks.instagram ? (
                  <Link href={church.socialLinks.instagram} target="_blank" rel="noreferrer">
                    Instagram
                  </Link>
                ) : null}
                {church.socialLinks.youtube ? (
                  <Link href={church.socialLinks.youtube} target="_blank" rel="noreferrer">
                    YouTube
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
