import Image from "next/image";
import Link from "next/link";

import { buildChurchProfilePath } from "@/lib/config/site";
import {
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
          <p className="eyebrow eyebrow--gold">{church.denomination}</p>
          <h3>{church.name}</h3>
          <p className="church-card__meta">{formatAddress(church.address)}</p>
        </div>
      </div>

      <p className="church-card__description">{church.description}</p>

      <div className="church-card__detail-grid">
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

      <Link href={buildChurchProfilePath(church.slug)} className="button button--secondary">
        View Church
      </Link>
    </article>
  );
}
