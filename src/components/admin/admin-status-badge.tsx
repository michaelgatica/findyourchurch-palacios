interface AdminStatusBadgeProps {
  status: string;
}

function toReadableStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status.replace(/_/g, "-")}`}>
      {toReadableStatus(status)}
    </span>
  );
}
