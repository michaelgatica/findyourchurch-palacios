import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSignOutButton } from "@/components/admin/admin-signout-button";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser) {
    redirect("/admin/login");
  }

  if (authenticatedUser.profile?.role !== "admin") {
    return (
      <section className="shell page-section admin-page">
        <div className="confirmation-card">
          <p className="eyebrow eyebrow--gold">Access Denied</p>
          <h1>This account does not have admin access</h1>
          <p>
            You are signed in as {authenticatedUser.email ?? "this account"}, but only users with
            the <strong>admin</strong> role can access the Find Your Church review tools.
          </p>
          <div className="button-row">
            <Link href="/" className="button button--ghost">
              Back to public site
            </Link>
            <AdminSignOutButton className="button button--secondary" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <AdminShell
      adminName={authenticatedUser.profile.name}
      adminEmail={authenticatedUser.profile.email}
    >
      {children}
    </AdminShell>
  );
}
