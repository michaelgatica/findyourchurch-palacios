import { DirectoryBrowser } from "@/components/directory-browser";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";
import {
  getDirectoryFilterOptions,
  getPublishedChurches,
} from "@/lib/repositories/church-repository";
import { resolveChurchesForDirectoryMap } from "@/lib/services/church-map-service";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Church Directory"),
  description: siteConfig.directoryDescription,
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
        <h1>{siteConfig.directoryHeading}</h1>
        <p>{siteConfig.directoryLead}</p>
      </div>

      <DirectoryBrowser churches={churchesWithMapCoordinates} filterOptions={filterOptions} />
    </section>
  );
}
