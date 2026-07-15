import Link from "next/link";

import { AdminSignOutButton } from "@/components/admin/admin-signout-button";
import { getNonProductionEnvironmentLabel } from "@/lib/app-environment";

const adminNavigationItems = [
  {
    href: "/admin",
    label: "Dashboard",
  },
  {
    href: "/admin/submissions",
    label: "Submissions",
  },
  {
    href: "/admin/churches",
    label: "Churches",
  },
  {
    href: "/admin/events",
    label: "Events",
  },
  {
    href: "/admin/event-reports",
    label: "Reports",
  },
  {
    href: "/admin/event-categories",
    label: "Categories",
  },
  {
    href: "/admin/ops",
    label: "Ops",
  },
  {
    href: "/admin/updates",
    label: "Updates",
  },
  {
    href: "/admin/claims",
    label: "Claims",
  },
] as const;

interface AdminShellProps {
  adminName: string;
  adminEmail?: string;
  children: React.ReactNode;
}

export function AdminShell({ adminName, adminEmail, children }: AdminShellProps) {
  const nonProductionLabel = getNonProductionEnvironmentLabel();

  return (
    <section className="shell page-section admin-page">
      <div className="admin-shell">
        {nonProductionLabel ? (
          <div className="nonproduction-banner" role="status">
            {nonProductionLabel} environment - use fictitious test data only
          </div>
        ) : null}

        <div className="admin-shell__header">
          <div>
            <p className="eyebrow eyebrow--gold">Internal Admin Portal</p>
            <p className="admin-shell__title">Find Your Church Admin</p>
            <p className="supporting-text">
              Signed in as {adminName}
              {adminEmail ? ` (${adminEmail})` : ""}.
            </p>
          </div>

          <AdminSignOutButton />
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {adminNavigationItems.map((navigationItem) => (
            <Link key={navigationItem.href} href={navigationItem.href} className="admin-nav__link">
              {navigationItem.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </section>
  );
}
