import { DirectoryBrowser } from "@/components/directory-browser";
import { createPageMetadata } from "@/lib/config/site";
import {
  getDirectoryFilterOptions,
  getPublishedChurches,
} from "@/lib/repositories/church-repository";

export const metadata = createPageMetadata({
  title: "Church Directory | Find Your Church Palacios",
  description:
    "Browse the Find Your Church Palacios directory to explore local churches, view service times, and connect with church communities in the Palacios area.",
  pathname: "/churches",
});

export default async function ChurchesPage() {
  const [churches, filterOptions] = await Promise.all([
    getPublishedChurches(),
    getDirectoryFilterOptions(),
  ]);

  return (
    <section className="shell page-section">
      <div className="page-intro">
        <p className="eyebrow eyebrow--gold">Church Directory</p>
        <h1>Find churches near you in Palacios, Texas</h1>
        <p>
          Browse published church listings, search by keyword, and filter by ministries, worship
          style, language, and accessibility details.
        </p>
      </div>

      <DirectoryBrowser churches={churches} filterOptions={filterOptions} />
    </section>
  );
}
