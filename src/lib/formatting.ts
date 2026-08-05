export const CENTRAL_TIMEZONE = 'America/Chicago';

/**
 * Formats time in Central Time (e.g., "6:00 PM")
 */
export function formatEventTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: CENTRAL_TIMEZONE,
  });
}

/**
 * Formats date in Central Time (e.g., "Tue, Sep 10, 2030")
 */
export function formatEventDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: CENTRAL_TIMEZONE,
  });
}

/**
 * Formats full Date & Time in Central Time (e.g., "Sep 10, 2030, 6:00 PM CT")
 */
export function formatEventDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return (
    date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: CENTRAL_TIMEZONE,
    }) + ' CT'
  );
}
