import Link from "next/link";
import { redirect } from "next/navigation";

import { PortalLoginForm } from "@/components/portal/portal-login-form";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Representative Login"),
  description: `Sign in to the ${siteConfig.launchName} church representative portal.`,
  pathname: "/portal/login",
  noIndex: true,
});

interface PortalLoginPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function PortalLoginPage({ searchParams }: PortalLoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = await getRepresentativePortalContext();
  const redirectPath =
    resolvedSearchParams.next && resolvedSearchParams.next.startsWith("/")
      ? resolvedSearchParams.next
      : "/portal";

  if (context?.representative && context.church) {
    redirect(redirectPath);
  }

  return (
    <section className="shell page-section portal-page auth-compact">
      <div className="portal-shell">
        {context ? (
          <div className="form-alert">
            You are signed in as {context.profile.email}, but this account does not currently have
            active church representative access.
          </div>
        ) : null}

        <PortalLoginForm redirectPath={redirectPath} />

        <div className="panel">
          <h2>Need access first?</h2>
          <p className="supporting-text">
            Pastors, staff members, and authorized representatives can use the public
            <strong> Claim This Church </strong>
            button on a church profile to request portal access.
          </p>
          <div className="button-row">
            <Link href="/churches" className="button button--ghost">
              Browse churches
            </Link>
            <Link href="/" className="button button--secondary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
