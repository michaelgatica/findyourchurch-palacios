"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  {
    href: "/about",
    label: "About",
  },
  {
    href: "/contact",
    label: "Contact",
  },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <div className="site-header__bar">
          <Link href="/" className="site-header__brand" aria-label="Find Your Church Palacios">
            <Image
              src="/assets/logos/find-your-church-palacios-landscape.png"
              alt="Find Your Church Palacios logo"
              width={246}
              height={111}
              priority
              className="site-header__brand-image"
            />
          </Link>

          <button
            type="button"
            className="site-header__menu-button"
            aria-expanded={isMenuOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          >
            <span className="site-header__menu-icon" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>{isMenuOpen ? "Close" : "Menu"}</span>
          </button>
        </div>

        <div
          className={`site-header__nav-shell${isMenuOpen ? " site-header__nav-shell--open" : ""}`}
          id="primary-navigation"
        >
          <nav className="site-nav" aria-label="Primary">
            {navigationItems.map((navigationItem) => (
              <Link
                key={navigationItem.href}
                href={navigationItem.href}
                className={`site-nav__link${
                  pathname === navigationItem.href ? " site-nav__link--active" : ""
                }`}
              >
                {navigationItem.label}
              </Link>
            ))}
          </nav>

          <Link href="/churches" className="button button--ghost site-header__claim-link">
            Claim a Church
          </Link>
        </div>
      </div>
    </header>
  );
}
