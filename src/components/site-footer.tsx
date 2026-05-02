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
            width={220}
            height={99}
            className="site-footer__brand-image"
          />
          <p>{siteConfig.organizationDescription}</p>
        </div>

        <div className="site-footer__links">
          <Link href="/churches">Explore local churches</Link>
          <Link href="/submit">Submit or update your church listing</Link>
        </div>

        <div className="site-footer__ministry">
          <Image
            src="/assets/logos/el-roi-digital-landscape.png"
            alt="El Roi Digital Ministries logo"
            width={173}
            height={52}
          />
          <p>Find Your Church is a ministry project powered by El Roi Digital Ministries.</p>
        </div>
      </div>
    </footer>
  );
}
