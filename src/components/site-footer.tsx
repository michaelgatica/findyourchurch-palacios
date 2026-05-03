import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/lib/config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="site-footer__brand-block">
          <Image
            src="/assets/logos/find-your-church-palacios-landscape.png"
            alt="Find Your Church Palacios logo"
            width={210}
            height={95}
            className="site-footer__brand-image"
          />
          <p>Find Your Church is a ministry project powered by El Roi Digital Ministries.</p>
        </div>

        <div className="site-footer__links">
          <Link href="/churches">Browse Churches</Link>
          <Link href="/submit">Submit Your Church</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/listing-guidelines">Listing Guidelines</Link>
        </div>

        <div className="site-footer__ministry">
          <Image
            src="/assets/logos/el-roi-digital-landscape.png"
            alt="El Roi Digital Ministries logo"
            width={160}
            height={48}
            className="site-footer__ministry-logo"
          />
          <p className="supporting-text">
            {siteConfig.launchName} is a free local church directory created to help people connect
            with church communities in the Palacios area.
          </p>
        </div>
      </div>
    </footer>
  );
}
