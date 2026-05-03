import Link from "next/link";

import { AdminSignOutButton } from "@/components/admin/admin-signout-button";

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
  return (
    <section className="shell page-section admin-page">
      <div className="admin-shell">
        <div className="admin-shell__header">
          <div>
            <p className="eyebrow eyebrow--gold">Internal Admin Portal</p>
            <h1>Find Your Church Admin</h1>
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
