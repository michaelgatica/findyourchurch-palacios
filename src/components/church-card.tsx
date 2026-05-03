import Image from "next/image";
import Link from "next/link";

import { buildChurchProfilePath } from "@/lib/config/site";
import {
  buildDirectionsUrl,
  formatAddress,
  getChurchCardTags,
  getChurchInitials,
  getPrimaryServiceTime,
} from "@/lib/church-utils";
import type { ChurchRecord } from "@/lib/types/directory";

export function ChurchCard({ church }: { church: ChurchRecord }) {
  const primaryServiceTime = getPrimaryServiceTime(church);
  const keyTags = getChurchCardTags(church);

  return (
    <article className="church-card">
      <div className="church-card__header">
        {church.logoSrc ? (
          <Image
            src={church.logoSrc}
            alt={`${church.name} logo`}
            width={72}
            height={72}
            className="church-card__logo-image"
          />
        ) : (
          <div className="church-card__logo-fallback" aria-hidden="true">
            {getChurchInitials(church.name)}
          </div>
        )}

        <div className="church-card__header-copy">
          <div className="church-card__badge-row">
            <span className="church-card__badge">{church.denomination}</span>
            {church.isSeedContent ? <p className="church-card__sample-note">Sample listing</p> : null}
          </div>
          <h3>{church.name}</h3>
          <p className="church-card__meta">{formatAddress(church.address)}</p>
        </div>
      </div>

      <p className="church-card__description">{church.description}</p>

      <div className="church-card__summary-grid">
        <div>
          <span className="church-card__label">Primary service</span>
          <p>{primaryServiceTime?.label ?? "Service times coming soon"}</p>
        </div>

        <div>
          <span className="church-card__label">Languages</span>
          <p>{church.languages.join(", ") || "Information coming soon"}</p>
        </div>
      </div>

      <div className="tag-row">
        {keyTags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="church-card__actions">
        <Link href={buildChurchProfilePath(church.slug)} className="button button--secondary">
          View Church
        </Link>
        <Link
          href={buildDirectionsUrl(church.address)}
          className="button button--ghost"
          target="_blank"
          rel="noreferrer"
        >
          Directions
        </Link>
        {church.website ? (
          <Link
            href={church.website}
            className="button button--ghost"
            target="_blank"
            rel="noreferrer"
          >
            Website
          </Link>
        ) : null}
      </div>
    </article>
  );
}
