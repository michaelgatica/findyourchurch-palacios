import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/lib/config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="site-footer__brand-block">
          <Image
            src={siteConfig.brandAssets.landscapeLogoSrc}
            alt={`${siteConfig.launchName} logo`}
            width={210}
            height={95}
            className="site-footer__brand-image"
          />
          <p>
            A trusted local guide to churches, service times, ministries, and community events.
          </p>
          <p className="site-footer__location">Serving {siteConfig.launchRegionLabel}.</p>
        </div>

        <div className="site-footer__navigation">
          <div className="site-footer__link-group">
            <h2>Explore</h2>
            <Link href="/churches">Church directory</Link>
            <Link href="/events">Community events</Link>
            <Link href="/submit">List your church</Link>
            <Link href="/about">About the ministry</Link>
          </div>
          <div className="site-footer__link-group">
            <h2>Support</h2>
            <Link href="/contact">Contact us</Link>
            <Link href="/listing-guidelines">Listing guidelines</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/portal/login">Church sign in</Link>
          </div>
        </div>

        <div className="site-footer__ministry">
          <Image
            src="/assets/logos/el-roi-digital-landscape.png"
            alt="El Roi Digital Ministries logo"
            width={160}
            height={48}
            className="site-footer__ministry-logo"
          />
          <p>
            {siteConfig.launchName} is provided free of charge by El Roi Digital Ministries. Help
            us continue spreading the Word of God and serving local churches.
          </p>
          <Link
            href={siteConfig.ministryDonationUrl}
            className="button button--primary"
            target="_blank"
            rel="noreferrer"
          >
            Support the ministry
          </Link>
        </div>
      </div>
      <div className="shell site-footer__bottom">
        <p>{"\u00A9"} {new Date().getFullYear()} El Roi Digital Ministries. Built to serve churches well.</p>
        <Link href="/admin">Platform administration</Link>
      </div>
    </footer>
  );
}
