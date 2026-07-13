import Link from "next/link";

import { updatePlatformEventReportAction } from "@/lib/actions/platform-events";
import { formatDateTime } from "@/lib/formatting";
import { listPlatformEventReports } from "@/lib/services/platform-event-admin-service";
import { eventReportStatuses } from "@/lib/types/events";

interface AdminEventReportsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminEventReportsPage({ searchParams }: AdminEventReportsPageProps) {
  const params = await searchParams;
  const activeStatus = eventReportStatuses.includes(params.status as never) ? params.status : "all";
  const reports = await listPlatformEventReports(activeStatus as never);

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Event moderation</p>
        <h1>Public event reports</h1>
        <p className="supporting-text">
          Public reports are private moderation records. A single report should trigger review, not
          automatic event removal.
        </p>
        <div className="status-filter-row">
          <Link href="/admin/event-reports" className={activeStatus === "all" ? "button button--secondary" : "button button--ghost"}>All</Link>
          {eventReportStatuses.map((status) => (
            <Link key={status} href={`/admin/event-reports?status=${status}`} className={activeStatus === status ? "button button--secondary" : "button button--ghost"}>
              {status}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-card-list">
        {reports.length === 0 ? (
          <div className="panel"><h2>No reports matched this filter</h2></div>
        ) : reports.map((report) => (
          <article key={report.id} className="panel admin-card-list__item">
            <div className="admin-card-list__header">
              <div>
                <p className="eyebrow">{report.reason.replaceAll("_", " ")}</p>
                <h2>{report.eventTitle}</h2>
                <p className="supporting-text">{report.churchName} · {formatDateTime(report.createdAt)}</p>
              </div>
              <span className={`status-badge status-badge--${report.status}`}>{report.status}</span>
            </div>
            <p>{report.message}</p>
            <div className="admin-metadata-grid">
              <div><strong>Reporter</strong><p>{report.reporterName || "Not provided"}</p></div>
              <div><strong>Email</strong><p>{report.reporterEmail || "Not provided"}</p></div>
              <div><strong>Event ID</strong><p>{report.eventId}</p></div>
              <div><strong>Internal note</strong><p>{report.internalNote || "None"}</p></div>
            </div>
            <form action={updatePlatformEventReportAction} className="admin-filter-form">
              <input type="hidden" name="reportId" value={report.id} />
              <select name="status" defaultValue={report.status}>
                {eventReportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input name="internalNote" placeholder="Internal moderation note" />
              <Link href={`/events/${report.eventSlug}`} className="button button--ghost">Review event</Link>
              <button className="button button--primary">Update report</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}

