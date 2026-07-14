"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  firebaseSessionChangedEvent,
  signOutApplicationSession,
} from "@/lib/firebase/session-client";
import { siteConfig } from "@/lib/config/site";

const navigationItems = [
  {
    href: "/churches",
    label: "Churches",
  },
  {
    href: "/events",
    label: "Events",
  },
  {
    href: "/submit",
    label: "List Your Church",
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

type HeaderUserRole = "admin" | "church_primary" | "church_editor" | "pending_user";

interface HeaderSessionUser {
  name: string;
  email: string;
  role: HeaderUserRole;
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "FY";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getRoleLabel(role: HeaderUserRole) {
  switch (role) {
    case "admin":
      return "Admin";
    case "church_primary":
      return "Primary representative";
    case "church_editor":
      return "Church editor";
    default:
      return "Directory account";
  }
}

function HeaderUserMenu({
  user,
  className,
  pathname,
}: {
  user: HeaderSessionUser | null;
  className?: string;
  pathname: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const initials = useMemo(
    () => getInitials(user?.name || user?.email || "Find Your Church"),
    [user?.email, user?.name],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    setErrorMessage(null);
    setIsPending(true);

    try {
      await signOutApplicationSession();
      window.location.assign("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not complete sign-out. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  function focusMenuItem(position: "first" | "last") {
    window.requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      );
      const target = position === "first" ? items?.[0] : items?.[items.length - 1];
      target?.focus();
    });
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") {
      items[0].focus();
      return;
    }
    if (event.key === "End") {
      items[items.length - 1].focus();
      return;
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : items.length - 1
      : (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  }

  return (
    <div className={`site-header__account-shell${className ? ` ${className}` : ""}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="site-header__account-button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => {
          setErrorMessage(null);
          if (isOpen) {
            setIsOpen(false);
          } else {
            setIsOpen(true);
            focusMenuItem("first");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setErrorMessage(null);
            setIsOpen(true);
            focusMenuItem(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
      >
        {user ? (
          <span className="site-header__account-avatar" aria-hidden="true">
            {initials}
          </span>
        ) : null}
        <span className={`site-header__account-label${!user ? " site-header__account-label--always" : ""}`}>
          {user ? "Account" : "Sign in"}
        </span>
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          className="site-header__account-menu"
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {user ? (
            <>
              <div className="site-header__account-meta" role="none">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <span>{getRoleLabel(user.role)}</span>
              </div>

              <Link href="/account" className="site-header__account-link" role="menuitem">
                My profile
              </Link>
              {user.role === "admin" ? (
                <Link href="/admin" className="site-header__account-link" role="menuitem">
                  Admin dashboard
                </Link>
              ) : null}
              {user.role === "church_primary" || user.role === "church_editor" ? (
                <>
                  <Link href="/portal" className="site-header__account-link" role="menuitem">
                    Church portal
                  </Link>
                  <Link
                    href="/portal/church/edit"
                    className="site-header__account-link"
                    role="menuitem"
                  >
                    Update church info
                  </Link>
                </>
              ) : null}
              <button
                type="button"
                className="site-header__account-action"
                role="menuitem"
                onClick={() => void handleSignOut()}
                disabled={isPending}
              >
                {isPending ? "Signing out..." : "Sign out"}
              </button>
              {errorMessage ? (
                <p className="site-header__account-error" aria-live="polite">
                  {errorMessage}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="site-header__account-meta" role="none">
                <strong>Account access</strong>
                <span>Sign in to manage a church listing or access admin tools.</span>
              </div>
              <Link href="/portal/login" className="site-header__account-link" role="menuitem">
                Church portal sign in
              </Link>
              <Link href="/admin/login" className="site-header__account-link" role="menuitem">
                Admin sign in
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<HeaderSessionUser | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const loadSessionUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Unable to load the current session.");
      }

      const payload = (await response.json()) as
        | {
            authenticated?: boolean;
            user?: HeaderSessionUser;
          }
        | null;

      setSessionUser(payload?.authenticated ? payload.user ?? null : null);
    } catch {
      setSessionUser(null);
    } finally {
      setHasLoadedSession(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      if (!isMounted) {
        return;
      }

      await loadSessionUser();
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [loadSessionUser, pathname]);

  useEffect(() => {
    function handleSessionChanged() {
      void loadSessionUser();
    }

    window.addEventListener(firebaseSessionChangedEvent, handleSessionChanged);

    return () => {
      window.removeEventListener(firebaseSessionChangedEvent, handleSessionChanged);
    };
  }, [loadSessionUser]);

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <div className="site-header__bar">
          <Link href="/" className="site-header__brand" aria-label={siteConfig.launchName}>
            <Image
              src={siteConfig.brandAssets.landscapeLogoSrc}
              alt={`${siteConfig.launchName} logo`}
              width={246}
              height={111}
              priority
              className="site-header__brand-image"
            />
          </Link>

          <div className="site-header__bar-actions">
            <HeaderUserMenu
              user={hasLoadedSession ? sessionUser : null}
              className="site-header__account-shell--mobile"
              pathname={pathname}
            />

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

          <Link href="/churches" className="button button--primary site-header__claim-link">
            Claim a Church
          </Link>

          <HeaderUserMenu
            user={hasLoadedSession ? sessionUser : null}
            className="site-header__account-shell--desktop"
            pathname={pathname}
          />
        </div>
      </div>
    </header>
  );
}
