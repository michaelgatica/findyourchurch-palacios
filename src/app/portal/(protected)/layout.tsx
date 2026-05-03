import Link from "next/link";

import { AdminSignOutButton } from "@/components/admin/admin-signout-button";
import { RepresentativeShell } from "@/components/portal/representative-shell";
import { requireRepresentativePortalSession } from "@/lib/services/representative-access-service";

export default async function ProtectedPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireRepresentativePortalSession("/portal");

  if (!context.representative || !context.church) {
    return (
      <section className="shell page-section portal-page">
        <div className="confirmation-card">
          <p className="eyebrow eyebrow--gold">Access Denied</p>
          <h1>This account does not have representative access</h1>
          <p>
            You are signed in as {context.profile.email}, but this account does not currently have
            an active <strong>churchRepresentatives</strong> record.
          </p>
          <div className="button-row">
            <Link href="/churches" className="button button--ghost">
              Browse churches
            </Link>
            <AdminSignOutButton className="button button--secondary" redirectTo="/portal/login" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <RepresentativeShell
      church={context.church}
      representative={context.representative}
      representativeName={context.profile.name}
    >
      {children}
    </RepresentativeShell>
  );
}
