import { DirectoryBrowser } from "@/components/directory-browser";
import { createPageMetadata } from "@/lib/config/site";
import {
  getDirectoryFilterOptions,
  getPublishedChurches,
} from "@/lib/repositories/church-repository";
import { resolveChurchesForDirectoryMap } from "@/lib/services/church-map-service";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Church Directory | Find Your Church Palacios",
  description:
    "Browse the Find Your Church Palacios directory to explore local churches, view service times, and connect with church communities in Palacios and nearby communities.",
  pathname: "/churches",
});

export default async function ChurchesPage() {
  const [churches, filterOptions] = await Promise.all([
    getPublishedChurches(),
    getDirectoryFilterOptions(),
  ]);
  const churchesWithMapCoordinates = await resolveChurchesForDirectoryMap(churches);

  return (
    <section className="shell page-section">
      <div className="page-intro">
        <p className="eyebrow eyebrow--gold">Church Directory</p>
        <h1>Find churches near you in Palacios and nearby communities</h1>
        <p>
          Search by church name, pastor, ministry, worship style, or service time, then use the
          map and filters below to narrow your results across Palacios and the surrounding area.
        </p>
      </div>

      <DirectoryBrowser churches={churchesWithMapCoordinates} filterOptions={filterOptions} />
    </section>
  );
}
