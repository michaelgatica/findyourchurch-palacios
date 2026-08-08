/**
 * Runs a notification after the authoritative database work has completed.
 * Delivery failures are recorded by the email service, but must not make a
 * successful listing or review action appear to have failed.
 */
export async function runNotificationBestEffort(
  sendNotification: () => Promise<void>,
) {
  try {
    await sendNotification();
    return true;
  } catch {
    return false;
  }
}
