import { sendRepresentativeChurchMessageAction } from "@/lib/actions/portal";
import { formatDateTime } from "@/lib/formatting";
import { getPublicChurchMessageThread } from "@/lib/services/church-messaging-service";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

interface PortalMessagesPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function PortalMessagesPage({ searchParams }: PortalMessagesPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church) {
    return null;
  }

  const messages = await getPublicChurchMessageThread(context.church.id);

  return (
    <div className="admin-content">
      {resolvedSearchParams.success ? (
        <div className="form-alert form-alert--success">Your message was sent.</div>
      ) : null}
      {resolvedSearchParams.error ? (
        <div className="form-alert">{resolvedSearchParams.error}</div>
      ) : null}

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Messages</p>
        <h1>Church listing conversations</h1>
        <p className="supporting-text">
          Public message history between the Find Your Church review team and your church. Internal
          admin notes are never shown here.
        </p>
      </div>

      <div className="panel">
        <form action={sendRepresentativeChurchMessageAction} className="submission-form">
          <input type="hidden" name="churchId" value={context.church.id} />
          <label className="field field--full">
            <span className="field__label">Send a message to admin</span>
            <textarea
              name="messageBody"
              placeholder="Share a question, clarification, or follow-up note."
              required
            />
          </label>
          <div className="submission-form__actions">
            <button type="submit" className="button button--primary">
              Send message
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Message history</h2>
        {messages.length === 0 ? (
          <p className="supporting-text">No messages have been shared on this listing yet.</p>
        ) : (
          <div className="timeline">
            {messages.map((message) => (
              <div key={message.id} className="timeline-item">
                <div className="timeline-item__meta">
                  <span>{message.senderType === "admin" ? "Admin" : "Church representative"}</span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p>{message.messageBody}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
