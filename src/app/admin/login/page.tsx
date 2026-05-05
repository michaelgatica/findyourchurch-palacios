import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminSignOutButton } from "@/components/admin/admin-signout-button";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Admin Login"),
  description: `Sign in to the ${siteConfig.launchName} admin portal.`,
  pathname: "/admin/login",
  noIndex: true,
});

interface AdminLoginPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();
  const redirectPath =
    resolvedSearchParams.next && resolvedSearchParams.next.startsWith("/")
      ? resolvedSearchParams.next
      : "/admin";

  if (authenticatedUser?.profile?.role === "admin") {
    redirect(redirectPath);
  }

  return (
    <section className="shell page-section admin-page">
      <div className="admin-login-card">
        <div className="panel">
          <p className="eyebrow eyebrow--gold">Internal Admin Portal</p>
          <h1>Sign in to review churches and claim requests</h1>
          <p className="supporting-text">
            Admin access is limited to users with the <strong>admin</strong> role in the
            Firestore <code>users</code> collection.
          </p>
          {authenticatedUser ? (
            <div className="form-alert">
              You are signed in as {authenticatedUser.email ?? "this account"}, but that account
              does not currently have admin access.
            </div>
          ) : null}
        </div>

        <AdminLoginForm redirectPath={redirectPath} />

        <div className="panel admin-support-card">
          <h2>Need help?</h2>
          <p className="supporting-text">
            Admin users should sign in with the Firebase Authentication email/password account that
            has a matching Firestore user profile with role <code>admin</code>.
          </p>
          <div className="button-row">
            <Link href="/" className="button button--ghost">
              Back to public site
            </Link>
            {authenticatedUser ? <AdminSignOutButton className="button button--secondary" /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
