import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/lib/config/site";

const navigationItems = [
  {
    href: "/",
    label: "Home",
  },
  {
    href: "/churches",
    label: "Browse Churches",
  },
  {
    href: "/submit",
    label: "Submit Your Church",
  },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="top-bar">
        <div className="shell top-bar__content">
          <p>{siteConfig.organizationDescription}</p>
          <Image
            src="/assets/logos/el-roi-digital-landscape.png"
            alt="El Roi Digital Ministries logo"
            width={173}
            height={52}
            className="top-bar__logo"
          />
        </div>
      </div>

      <div className="shell site-header__inner">
        <Link href="/" className="site-header__brand" aria-label={siteConfig.launchName}>
          <Image
            src="/assets/logos/find-your-church-palacios-landscape.png"
            alt="Find Your Church Palacios logo"
            width={246}
            height={111}
            priority
            className="site-header__brand-image"
          />
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navigationItems.map((navigationItem) => (
            <Link key={navigationItem.href} href={navigationItem.href} className="site-nav__link">
              {navigationItem.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
