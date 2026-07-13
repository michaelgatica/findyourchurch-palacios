import { buildAbsoluteUrl, siteConfig } from "@/lib/config/site";
import { sendTransactionalEmail } from "@/lib/services/email-service";
import type { EventRecord } from "@/lib/types/events";
import type { RegistrationRecord } from "@/lib/types/registrations";

function link(label: string, url: string) {
  return `[${label}](${url})`;
}

function ministryNote() {
  return `${siteConfig.launchName} is a ministry project created by ${siteConfig.ministryName} to help churches be searchable, visible, and easier to connect with.`;
}

function managementUrl(accessToken: string) {
  return buildAbsoluteUrl(`/registrations/manage/${encodeURIComponent(accessToken)}`);
}

export interface RegistrationNotificationEmail {
  to: string;
  subject: string;
  body: string;
  relatedEntityType: "eventRegistration";
  relatedEntityId: string;
}

export function buildRegistrantRegistrationConfirmationEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
  accessToken: string;
  managementEnabled: boolean;
}): RegistrationNotificationEmail | null {
  if (!input.registration.contactEmail) {
    return null;
  }

  const isWaitlisted = input.registration.status === "waitlisted";
  const managementLine = input.managementEnabled
    ? `You can review${input.registration.status === "confirmed" ? ", edit," : ""} or cancel this registration here: ${link("Manage registration", managementUrl(input.accessToken))}`
    : null;

  return {
    to: input.registration.contactEmail,
    subject: isWaitlisted
      ? `Waitlist confirmation for ${input.event.title}`
      : `Registration confirmed for ${input.event.title}`,
    body: [
      `Hello ${input.registration.contactName},`,
      "",
      isWaitlisted
        ? `Your registration for ${input.event.title} has been added to the waitlist.`
        : `Your registration for ${input.event.title} is confirmed.`,
      "",
      `Confirmation number: ${input.registration.confirmationNumber}`,
      `Number attending: ${input.registration.attendeeCount}`,
      managementLine,
      "",
      isWaitlisted
        ? "We will notify you if space becomes available and your registration is promoted."
        : "Please keep this confirmation number for your records.",
      "",
      ministryNote(),
    ].filter((line) => line !== null).join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}

export async function sendRegistrantRegistrationConfirmation(input: {
  event: EventRecord;
  registration: RegistrationRecord;
  accessToken: string;
  managementEnabled: boolean;
}) {
  const email = buildRegistrantRegistrationConfirmationEmail(input);
  if (!email) {
    return;
  }
  await sendTransactionalEmail(email);
}

export async function sendRegistrationUpdatedNotification(input: {
  event: EventRecord;
  registration: RegistrationRecord;
  accessToken: string;
}) {
  const email = buildRegistrationUpdatedNotificationEmail(input);
  if (!email) {
    return;
  }

  await sendTransactionalEmail(email);
}

export function buildRegistrationUpdatedNotificationEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
  accessToken: string;
}): RegistrationNotificationEmail | null {
  if (!input.registration.contactEmail) {
    return null;
  }

  return {
    to: input.registration.contactEmail,
    subject: `Registration updated for ${input.event.title}`,
    body: [
      `Hello ${input.registration.contactName},`,
      "",
      `Your registration for ${input.event.title} has been updated.`,
      `Confirmation number: ${input.registration.confirmationNumber}`,
      `Number attending: ${input.registration.attendeeCount}`,
      "",
      `Review your registration here: ${link("Manage registration", managementUrl(input.accessToken))}`,
      "",
      ministryNote(),
    ].join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}

export async function sendWaitlistPromotionNotification(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}) {
  const email = buildWaitlistPromotionNotificationEmail(input);
  if (!email) {
    return;
  }

  await sendTransactionalEmail(email);
}

export function buildWaitlistPromotionNotificationEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}): RegistrationNotificationEmail | null {
  if (!input.registration.contactEmail) {
    return null;
  }

  return {
    to: input.registration.contactEmail,
    subject: `Space is available for ${input.event.title}`,
    body: [
      `Hello ${input.registration.contactName},`,
      "",
      `Good news - your waitlisted registration for ${input.event.title} is now confirmed.`,
      `Confirmation number: ${input.registration.confirmationNumber}`,
      `Number attending: ${input.registration.attendeeCount}`,
      "",
      ministryNote(),
    ].join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}

export async function sendRegistrationCancellationNotification(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}) {
  const email = buildRegistrationCancellationNotificationEmail(input);
  if (!email) {
    return;
  }

  await sendTransactionalEmail(email);
}

export function buildRegistrationCancellationNotificationEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}): RegistrationNotificationEmail | null {
  if (!input.registration.contactEmail) {
    return null;
  }

  return {
    to: input.registration.contactEmail,
    subject: `Registration cancelled for ${input.event.title}`,
    body: [
      `Hello ${input.registration.contactName},`,
      "",
      `Your registration for ${input.event.title} has been cancelled.`,
      `Confirmation number: ${input.registration.confirmationNumber}`,
      "",
      `If this was a mistake, please contact ${input.event.contactEmail ?? siteConfig.contactEmail}.`,
      "",
      ministryNote(),
    ].join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}

export async function sendEventCancellationToRegistrant(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}) {
  const email = buildEventCancellationEmail(input);
  if (!email) {
    return;
  }

  await sendTransactionalEmail(email);
}

export function buildEventCancellationEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}): RegistrationNotificationEmail | null {
  if (!input.registration.contactEmail) {
    return null;
  }

  return {
    to: input.registration.contactEmail,
    subject: `Event cancelled: ${input.event.title}`,
    body: [
      `Hello ${input.registration.contactName},`,
      "",
      `${input.event.title} has been cancelled by the host church.`,
      input.event.cancellationMessage ?? "Please contact the host church if you need more information.",
      "",
      `Your confirmation number was ${input.registration.confirmationNumber}.`,
      "",
      ministryNote(),
    ].join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}

export async function sendEventReminderToRegistrant(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}) {
  const email = buildEventReminderEmail(input);
  if (!email) {
    return;
  }

  await sendTransactionalEmail(email);
}

export function buildEventReminderEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
}): RegistrationNotificationEmail | null {
  if (!input.registration.contactEmail) {
    return null;
  }

  return {
    to: input.registration.contactEmail,
    subject: `Reminder: ${input.event.title}`,
    body: [
      `Hello ${input.registration.contactName},`,
      "",
      `This is a reminder that you are registered for ${input.event.title}.`,
      `Confirmation number: ${input.registration.confirmationNumber}`,
      "",
      "Please review the public event page for current time, location, and host instructions.",
    ].join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}

export async function sendOrganizerRegistrationNotification(input: {
  event: EventRecord;
  registration: RegistrationRecord;
  capacityReached: boolean;
}) {
  const email = buildOrganizerRegistrationNotificationEmail(input);
  if (!email) {
    return;
  }

  await sendTransactionalEmail(email);
}

export function buildOrganizerRegistrationNotificationEmail(input: {
  event: EventRecord;
  registration: RegistrationRecord;
  capacityReached: boolean;
}): RegistrationNotificationEmail | null {
  if (!input.event.contactEmail) {
    return null;
  }

  const isWaitlisted = input.registration.status === "waitlisted";
  return {
    to: input.event.contactEmail,
    subject: isWaitlisted
      ? `New waitlist registration for ${input.event.title}`
      : `New registration for ${input.event.title}`,
    body: [
      `${input.registration.contactName} submitted a registration for ${input.event.title}.`,
      "",
      `Status: ${input.registration.status}`,
      `Number attending: ${input.registration.attendeeCount}`,
      `Confirmation number: ${input.registration.confirmationNumber}`,
      input.capacityReached ? "The configured event capacity has been reached." : null,
      "",
      `Open registration management: ${link("View event registrations", buildAbsoluteUrl(`/portal/events/${input.event.id}/registration`))}`,
      "",
      "Sensitive form answers are intentionally not included in this email.",
    ].filter((line) => line !== null).join("\n"),
    relatedEntityType: "eventRegistration",
    relatedEntityId: input.registration.id,
  };
}
