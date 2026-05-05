import { SubmitChurchForm } from "@/components/submit-church-form";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Submit Your Church"),
  description: `Submit your church listing to ${siteConfig.launchName} for review so residents, visitors, and families can discover and connect with your church.`,
  pathname: "/submit",
});

export default function SubmitChurchPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Submit Your Church</p>
        <h1>Share a church listing with {siteConfig.launchName}</h1>
        <p>
          Use this form to submit a church listing for review. New submissions are saved as pending
          review before they appear publicly in the directory. If we need clarification, we will
          follow up before publishing.
        </p>
        <p className="supporting-text">{siteConfig.currentListingScope}</p>
      </div>

      <SubmitChurchForm />
    </section>
  );
}
