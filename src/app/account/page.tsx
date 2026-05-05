import Link from "next/link";
import { redirect } from "next/navigation";

import { createPageMetadata } from "@/lib/config/site";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { updateProfileAction } from "@/lib/actions/account";

export const metadata = createPageMetadata({
  title: "My Account | Find Your Church Palacios",
  description: "Update your Find Your Church account profile information.",
  pathname: "/account",
  noIndex: true,
});

function formatRoleLabel(role?: string | null) {
  switch (role) {
    case "admin":
      return "Admin";
    case "church_primary":
      return "Primary church representative";
    case "church_editor":
      return "Church editor";
    default:
      return "Directory account";
  }
}

interface AccountPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();
  const resolvedSearchParams = await searchParams;

  if (!authenticatedUser) {
    redirect("/portal/login?next=/account");
  }

  const profile = authenticatedUser.profile;
  const displayName =
    profile?.name ?? authenticatedUser.email?.split("@")[0] ?? "Find Your Church User";
  const email = profile?.email ?? authenticatedUser.email ?? "";
  const role = profile?.role ?? "pending_user";

  return (
    <section className="shell page-section">
      <div className="content-page-stack">
        <div className="panel content-card">
          <p className="eyebrow eyebrow--gold">My Account</p>
          <h1>Manage your account details</h1>
          <p>
            Update the basic contact information connected to your Find Your Church account. If
            your account has church representative access, you can also jump directly into the
            listing tools from here.
          </p>
          <div className="button-row">
            {role === "admin" ? (
              <Link href="/admin" className="button button--ghost">
                Admin Dashboard
              </Link>
            ) : null}
            {role === "church_primary" || role === "church_editor" ? (
              <>
                <Link href="/portal" className="button button--ghost">
                  Church Portal
                </Link>
                <Link href="/portal/church/edit" className="button button--ghost">
                  Update Church Info
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <div className="panel content-card">
          {resolvedSearchParams.success === "profile-updated" ? (
            <div className="form-alert form-alert--success">Your profile has been updated.</div>
          ) : null}
          {resolvedSearchParams.error === "name-required" ? (
            <div className="form-alert">Please enter your name before saving.</div>
          ) : null}

          <form action={updateProfileAction} className="submission-form">
            <div className="form-grid">
              <label className="field">
                <span className="field__label">
                  Name <span className="field__required">Required</span>
                </span>
                <input name="name" defaultValue={displayName} required />
              </label>

              <label className="field">
                <span className="field__label">Phone</span>
                <input name="phone" defaultValue={profile?.phone ?? ""} />
              </label>

              <label className="field field--full">
                <span className="field__label">Email address</span>
                <input value={email} readOnly disabled />
                <span className="field__hint">
                  Your sign-in email is managed through Firebase Authentication and is shown here
                  for reference.
                </span>
              </label>

              <label className="field">
                <span className="field__label">Account role</span>
                <input value={formatRoleLabel(role)} readOnly disabled />
              </label>
            </div>

            <div className="submission-form__actions">
              <button type="submit" className="button button--primary">
                Save profile
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
