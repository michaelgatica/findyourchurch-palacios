import { AdminSignOutButton } from "@/components/admin/admin-signout-button";
import { RepresentativeNav } from "@/components/portal/representative-nav";
import { getNonProductionEnvironmentLabel } from "@/lib/app-environment";
import type { ChurchRecord, ChurchRepresentativeRecord } from "@/lib/types/directory";

export function RepresentativeShell(props: {
  church: ChurchRecord;
  representative: ChurchRepresentativeRecord;
  representativeName: string;
  children: React.ReactNode;
}) {
  const nonProductionLabel = getNonProductionEnvironmentLabel();

  return (
    <section className="shell page-section portal-page">
      <div className="portal-shell">
        {nonProductionLabel ? (
          <div className="nonproduction-banner" role="status">
            {nonProductionLabel} environment - use fictitious test data only
          </div>
        ) : null}

        <div className="portal-shell__header">
          <div>
            <p className="eyebrow eyebrow--gold">Church Representative Portal</p>
            <p className="portal-shell__title">{props.church.name}</p>
            <p className="supporting-text">
              Signed in as {props.representativeName} (
              {props.representative.permissionRole.replace(/_/g, " ")}). Use this portal to keep
              your listing accurate, communicate with admin, and track update activity.
            </p>
          </div>

          <AdminSignOutButton className="button button--ghost" redirectTo="/portal/login" />
        </div>

        <RepresentativeNav
          churchName={props.church.name}
          permissionRole={props.representative.permissionRole}
        />

        {props.children}
      </div>
    </section>
  );
}
