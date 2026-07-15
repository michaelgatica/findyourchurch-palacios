import Link from "next/link";

import { AdminSignOutButton } from "@/components/admin/admin-signout-button";
import { getNonProductionEnvironmentLabel } from "@/lib/app-environment";
import type { ChurchRecord, ChurchRepresentativeRecord } from "@/lib/types/directory";

const navigationItems = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/church", label: "Church" },
  { href: "/portal/church/edit", label: "Edit Listing" },
  { href: "/portal/events", label: "Events" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/team", label: "Team" },
  { href: "/portal/transfer-ownership", label: "Transfer Ownership" },
  { href: "/portal/updates", label: "Updates" },
] as const;

export function RepresentativeShell(props: {
  church: ChurchRecord;
  representative: ChurchRepresentativeRecord;
  representativeName: string;
  children: React.ReactNode;
}) {
  const nonProductionLabel = getNonProductionEnvironmentLabel();

  return (
    <section className="shell page-section portal-page">
      <div className="portal-shell">
        {nonProductionLabel ? (
          <div className="nonproduction-banner" role="status">
            {nonProductionLabel} environment - use fictitious test data only
          </div>
        ) : null}

        <div className="portal-shell__header">
          <div>
            <p className="eyebrow eyebrow--gold">Church Representative Portal</p>
            <p className="portal-shell__title">{props.church.name}</p>
            <p className="supporting-text">
              Signed in as {props.representativeName} (
              {props.representative.permissionRole.replace(/_/g, " ")}). Use this portal to keep
              your listing accurate, communicate with admin, and track update activity.
            </p>
          </div>

          <AdminSignOutButton className="button button--ghost" redirectTo="/portal/login" />
        </div>

        <nav className="portal-nav" aria-label="Representative">
          {navigationItems.map((navigationItem) => (
            <Link
              key={navigationItem.href}
              href={navigationItem.href}
              className="portal-nav__link"
            >
              {navigationItem.label}
            </Link>
          ))}
        </nav>

        {props.children}
      </div>
    </section>
  );
}
