import Image from "next/image";
import Link from "next/link";

import {
  buildAbsoluteUrl,
  buildChurchProfilePath,
} from "@/lib/config/site";
import {
  buildDirectionsUrl,
  formatAddress,
  getChurchInitials,
  getPrimaryServiceTime,
} from "@/lib/church-utils";
import type { ChurchRecord } from "@/lib/types/directory";

function ContactButton({
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
    <Link href={href} className="button button--secondary" target="_blank" rel="noreferrer">
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
  const canonicalPath = buildChurchProfilePath(church.slug);
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
              <p className="eyebrow eyebrow--gold">{church.denomination}</p>
              <h1>{church.name}</h1>
              <p className="profile-hero__subtitle">
                {church.specificAffiliation ?? "Serving the Palacios area"}
              </p>
              <p className="profile-hero__service-time">
                {primaryServiceTime?.label ?? "Service times coming soon"}
              </p>
              <p className="profile-hero__address">{formatAddress(church.address)}</p>
            </div>
          </div>

          <div className="profile-hero__actions">
            <ContactButton href={`tel:${church.phone.replace(/\s+/g, "")}`} label="Call" />
            <ContactButton href={`mailto:${church.email}`} label="Email" />
            <ContactButton href={church.website} label="Website" />
            <ContactButton href={buildDirectionsUrl(church.address)} label="Directions" />
          </div>
        </div>
      </section>

      <section className="shell profile-layout">
        <div className="profile-main">
          <div className="panel">
            <p className="eyebrow">Church Profile</p>
            <h2>About this church</h2>
            <p>{church.description}</p>
            {church.statementOfFaith ? <p className="supporting-text">{church.statementOfFaith}</p> : null}
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
        </div>

        <aside className="profile-sidebar">
          <div className="panel">
            <h2>Church details</h2>
            <dl className="detail-list">
              <DetailRow label="Denomination / tradition" value={church.denomination} />
              <DetailRow label="Specific affiliation" value={church.specificAffiliation} />
              <DetailRow
                label={church.clergyLabel ?? "Pastor / priest / reverend"}
                value={church.primaryClergyName}
              />
              <DetailRow label="Additional clergy / leaders" value={church.additionalLeaders.join(", ")} />
              <DetailRow label="Phone" value={church.phone} />
              <DetailRow label="Email" value={church.email} />
              <DetailRow label="Website" value={church.website} />
              <DetailRow label="Worship style" value={church.worshipStyle} />
              <DetailRow label="Languages offered" value={church.languages.join(", ")} />
              <DetailRow
                label="Online giving"
                value={church.onlineGivingUrl ? "Available through listed website" : "Not listed"}
              />
              <DetailRow
                label="Last verified"
                value={church.lastVerifiedAt ? new Date(church.lastVerifiedAt).toLocaleDateString() : "Pending verification"}
              />
            </dl>
          </div>

          <div className="panel">
            <h2>Ministry and access</h2>
            <div className="feature-grid">
              <BooleanFeature enabled={church.features.childrenMinistry} label="Children's ministry" />
              <BooleanFeature enabled={church.features.youthMinistry} label="Youth ministry" />
              <BooleanFeature enabled={church.features.nurseryCare} label="Nursery care" />
              <BooleanFeature enabled={church.features.spanishService} label="Spanish service" />
              <BooleanFeature enabled={church.features.livestream} label="Livestream" />
              <BooleanFeature enabled={church.features.wheelchairAccessible} label="Wheelchair accessible" />
            </div>
          </div>

          <div className="panel">
            <h2>Ministry tags</h2>
            <div className="tag-row">
              {church.ministryTags.map((tag) => (
                <span key={tag.id} className="tag">
                  {tag.label}
                </span>
              ))}
            </div>
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
