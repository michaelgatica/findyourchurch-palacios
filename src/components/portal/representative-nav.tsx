"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type PortalIconName = "dashboard" | "church" | "edit" | "events" | "messages" | "team" | "transfer" | "updates";

const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/portal", label: "Dashboard", icon: "dashboard" as const, exact: true },
      { href: "/portal/events", label: "Events", icon: "events" as const },
    ],
  },
  {
    label: "Church profile",
    items: [
      { href: "/portal/church", label: "Church overview", icon: "church" as const, exact: true },
      { href: "/portal/church/edit", label: "Edit listing", icon: "edit" as const },
      { href: "/portal/team", label: "Team", icon: "team" as const },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/portal/messages", label: "Messages", icon: "messages" as const },
      { href: "/portal/updates", label: "Update activity", icon: "updates" as const },
    ],
  },
] as const;

const ownershipItem = {
  href: "/portal/transfer-ownership",
  label: "Transfer ownership",
  icon: "transfer" as const,
};

function PortalIcon({ name }: { name: PortalIconName }) {
  const paths: Record<PortalIconName, React.ReactNode> = {
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    church: <><path d="M4 20h16" /><path d="M6 20V9l6-4 6 4v11" /><path d="M10 20v-5h4v5" /><path d="M12 5V2" /><path d="M10 3h4" /></>,
    edit: <><path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 2 2" /></>,
    events: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M8 14h3M8 17h5" /></>,
    messages: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.3 8.3 0 0 1-3.4-.7L4 20l1.4-3.7A7.3 7.3 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M15 5.5a3 3 0 0 1 0 5.8M16 14.5a5.2 5.2 0 0 1 4.5 5" /></>,
    transfer: <><path d="M7 7h11l-3-3M18 7l-3 3" /><path d="M17 17H6l3 3M6 17l3-3" /></>,
    updates: <><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 12h8M8 15h5" /></>,
  };

  return (
    <svg className="portal-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function isActivePath(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function RepresentativeNav({
  churchName,
  permissionRole,
}: {
  churchName: string;
  permissionRole: string;
}) {
  const pathname = usePathname();
  const roleLabel = permissionRole.replace(/_/g, " ");

  return (
    <aside className="portal-nav" aria-label="Church portal navigation">
      <div className="portal-nav__identity">
        <span className="portal-nav__mark" aria-hidden="true">FY</span>
        <div>
          <p className="portal-nav__brand">Church portal</p>
          <p className="portal-nav__workspace">Representative workspace</p>
        </div>
      </div>

      <div className="portal-nav__church-card">
        <span className="portal-nav__church-label">Current church</span>
        <strong>{churchName}</strong>
        <span className="portal-nav__role"><span className="portal-nav__status-dot" aria-hidden="true" />{roleLabel}</span>
      </div>

      <nav className="portal-nav__links" aria-label="Portal sections">
        {navigationGroups.map((group) => (
          <div className="portal-nav__group" key={group.label}>
            <p className="portal-nav__group-label">{group.label}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="portal-nav__link"
                aria-current={isActivePath(pathname, item.href, "exact" in item && item.exact) ? "page" : undefined}
              >
                <PortalIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
        <div className="portal-nav__group portal-nav__group--ownership">
          <p className="portal-nav__group-label">Ownership</p>
          <Link
            href={ownershipItem.href}
            className="portal-nav__link"
            aria-current={isActivePath(pathname, ownershipItem.href) ? "page" : undefined}
          >
            <PortalIcon name={ownershipItem.icon} />
            <span>{ownershipItem.label}</span>
          </Link>
        </div>
      </nav>

      <div className="portal-nav__footer">
        <span className="portal-nav__footer-mark" aria-hidden="true">✦</span>
        <p><strong>Keep your church current</strong><span>Updates help neighbors find the right next step.</span></p>
      </div>
    </aside>
  );
}
