import { SubmitChurchForm } from "@/components/submit-church-form";
import { createPageMetadata } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: "Submit Your Church | Find Your Church Palacios",
  description:
    "Submit your church listing to Find Your Church Palacios for review so residents, visitors, and families can discover and connect with your church.",
  pathname: "/submit",
});

export default function SubmitChurchPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Submit Your Church</p>
        <h1>Share a church listing with Find Your Church Palacios</h1>
        <p>
          Use this form to submit a church listing for review. New submissions are saved as pending
          review before they appear publicly in the directory. If we need clarification, we will
          follow up before publishing.
        </p>
      </div>

      <SubmitChurchForm />
    </section>
  );
}
