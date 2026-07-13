import { getProductionConfigurationSummary } from "@/lib/services/production-config-service";
import { listRecentOperationalEvents } from "@/lib/services/operational-log-service";
import { formatDateTime } from "@/lib/formatting";

export default async function AdminOpsPage() {
  const [config, operationalEvents] = await Promise.all([
    Promise.resolve(getProductionConfigurationSummary()),
    listRecentOperationalEvents(20),
  ]);

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Launch readiness</p>
        <h1>Operations and configuration checks</h1>
        <p className="supporting-text">
          This page does not print secret values. It identifies missing production settings,
          scheduler protections, email readiness, and monitoring gaps for launch review.
        </p>
        <div className="admin-inline-stats">
          <span>Passed: {config.passed}</span>
          <span>Warnings: {config.warnings}</span>
          <span>Failures: {config.failed}</span>
        </div>
      </div>

      <div className="admin-card-list">
        {config.checks.map((check) => (
          <div key={`${check.key}-${check.label}`} className="panel admin-card-list__item">
            <div className="admin-card-list__header">
              <div>
                <p className="eyebrow">{check.scope}</p>
                <h2>{check.label}</h2>
                <p className="supporting-text">{check.key}</p>
              </div>
              <span className={`status-badge status-badge--${check.status === "pass" ? "published" : check.status === "fail" ? "denied" : "pending_review"}`}>
                {check.status}
              </span>
            </div>
            <p>{check.message}</p>
          </div>
        ))}
      </div>

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Operational events</p>
        <h2>Recent warnings and workflow activity</h2>
        <p className="supporting-text">
          These entries are safe summaries only. Registration answers, secrets, and access tokens
          should never be written here.
        </p>
      </div>

      <div className="admin-card-list">
        {operationalEvents.length === 0 ? (
          <div className="panel"><h2>No operational events have been logged yet</h2></div>
        ) : operationalEvents.map((event) => (
          <div key={String(event.id)} className="panel admin-card-list__item">
            <div className="admin-card-list__header">
              <div>
                <p className="eyebrow">{String(event.severity ?? "info")}</p>
                <h2>{String(event.type ?? "Operational event")}</h2>
                <p className="supporting-text">{formatDateTime(String(event.createdAt ?? ""))}</p>
              </div>
              <span className={`status-badge status-badge--${event.severity === "error" ? "denied" : event.severity === "warning" ? "pending_review" : "published"}`}>
                {String(event.severity ?? "info")}
              </span>
            </div>
            <p>{String(event.summary ?? "")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
