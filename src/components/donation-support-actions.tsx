import { getDonationUrl } from "@/lib/config/site";

interface DonationSupportActionsProps {
  buttonClassName?: string;
}

export function DonationSupportActions({
  buttonClassName = "button button--primary",
}: DonationSupportActionsProps) {
  const donationUrl = getDonationUrl();

  if (!donationUrl) {
    return null;
  }

  return (
    <div className="button-row">
      <a
        href={donationUrl}
        className={buttonClassName}
        zeffy-form-link={donationUrl}
        target="_blank"
        rel="noreferrer"
      >
        Support This Ministry
      </a>
      <a
        href={donationUrl}
        className="button button--ghost"
        zeffy-form-link={donationUrl}
        target="_blank"
        rel="noreferrer"
      >
        Help Keep This Directory Free
      </a>
      <a
        href={donationUrl}
        className="button button--secondary"
        zeffy-form-link={donationUrl}
        target="_blank"
        rel="noreferrer"
      >
        Give to Support Find Your Church
      </a>
    </div>
  );
}
