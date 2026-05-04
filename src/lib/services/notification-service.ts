import { buildAbsoluteUrl, buildChurchProfilePath } from "@/lib/config/site";
import type {
  ChurchClaimRequestRecord,
  ChurchRecord,
  ChurchSubmissionRecord,
  ChurchUpdateRequestRecord,
  ChurchRepresentativeRecord,
  OwnershipTransferRequestRecord,
} from "@/lib/types/directory";

import { sendTransactionalEmail } from "@/lib/services/email-service";

function getAdminNotificationEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || null;
}

export async function queueSubmissionReceivedNotification(
  submission: ChurchSubmissionRecord,
) {
  const accountCreatedMessage = submission.requestedManagerAccount
    ? [
        "",
        `We also created a Find Your Church account for ${submission.requestedManagerAccount.email}. Once the listing is approved, that account can be connected as the listing manager so the church can keep this page updated.`,
      ]
    : [];

  await sendTransactionalEmail({
    to: submission.submitterEmail,
    subject: "We received your church listing submission",
    body: [
      "Thank you for submitting your church to Find Your Church Palacios. We received your listing and will review it for accuracy before publishing. Please allow up to 24 hours for approval.",
      "",
      "If we need any clarification or edits, we will contact you.",
      ...accountCreatedMessage,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries. Our desire is to help churches be searchable, visible, and easy to connect with.",
    ].join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: submission.id,
  });

  const adminNotificationEmail = getAdminNotificationEmail();

  if (!adminNotificationEmail) {
    return;
  }

  await sendTransactionalEmail({
    to: adminNotificationEmail,
    subject: "New church listing pending approval",
    body: [
      "A new church listing has been submitted and is waiting for review in the Find Your Church admin portal.",
      "",
      `Church name: ${submission.churchDraft.name}`,
      `Submitter name: ${submission.submitterName}`,
      `Submitter email: ${submission.submitterEmail}`,
      submission.requestedManagerAccount
        ? `Manager account requested: ${submission.requestedManagerAccount.email}`
        : undefined,
      `Submission time: ${submission.submittedAt ?? submission.createdAt}`,
      "",
      `Review it here: ${buildAbsoluteUrl(`/admin/submissions/${submission.id}`)}`,
    ].filter(Boolean).join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: submission.id,
  });
}

export async function sendSubmissionApprovedNotification(input: {
  submission: ChurchSubmissionRecord;
  church: ChurchRecord;
  managerAccountAssigned?: boolean;
}) {
  await sendTransactionalEmail({
    to: input.submission.submitterEmail,
    subject: "Your church listing has been approved",
    body: [
      `Your church listing for ${input.church.name} has been approved and is now listed on Find Your Church Palacios.`,
      "",
      "You can view the listing here:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church.slug)),
      ...(input.managerAccountAssigned && input.submission.requestedManagerAccount
        ? [
            "",
            `The Find Your Church account for ${input.submission.requestedManagerAccount.email} can now sign in to help manage this listing.`,
          ]
        : []),
      "",
      "Thank you for helping us keep local church information accurate and easy to find.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: input.submission.id,
  });
}

export async function sendSubmissionDeniedNotification(input: {
  submission: ChurchSubmissionRecord;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.submission.submitterEmail,
    subject: "Update regarding your church listing submission",
    body: [
      `Thank you for submitting ${input.submission.churchDraft.name} to Find Your Church Palacios.`,
      "",
      "At this time, we are unable to publish the listing as submitted.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "If you believe this was in error or would like to submit corrected information, please contact us or submit a new request.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: input.submission.id,
  });
}

export async function sendSubmissionChangesRequestedNotification(input: {
  submission: ChurchSubmissionRecord;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.submission.submitterEmail,
    subject: "Changes requested for your church listing",
    body: [
      `Thank you for submitting ${input.submission.churchDraft.name} to Find Your Church Palacios.`,
      "",
      "Before we can publish the listing, we need a few updates or clarifications.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Please respond with the needed information or submit an updated request.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: input.submission.id,
  });
}

export async function sendSubmissionMessageNotification(input: {
  submission: ChurchSubmissionRecord;
  messageBody: string;
}) {
  await sendTransactionalEmail({
    to: input.submission.submitterEmail,
    subject: "Message regarding your church listing submission",
    body: [
      `A message has been added regarding your submission for ${input.submission.churchDraft.name}.`,
      "",
      input.messageBody,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: input.submission.id,
  });
}

export async function sendClaimReceivedNotification(input: {
  claimRequest: ChurchClaimRequestRecord;
  church: ChurchRecord;
}) {
  await sendTransactionalEmail({
    to: input.claimRequest.requesterEmail,
    subject: "We received your church access request",
    body: [
      `Thank you for requesting access to help manage the listing for ${input.church.name}.`,
      "",
      "Your request has been received. Please allow up to 24 hours for review.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });

  const adminNotificationEmail = getAdminNotificationEmail();

  if (!adminNotificationEmail) {
    return;
  }

  await sendTransactionalEmail({
    to: adminNotificationEmail,
    subject: "New church claim request pending review",
    body: [
      "A church claim request is waiting for review in the Find Your Church admin portal.",
      "",
      `Church name: ${input.church.name}`,
      `Requester name: ${input.claimRequest.requesterName}`,
      `Requester email: ${input.claimRequest.requesterEmail}`,
      `Request time: ${input.claimRequest.createdAt}`,
      "",
      `Review it here: ${buildAbsoluteUrl(`/admin/claims/${input.claimRequest.id}`)}`,
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });
}

export async function sendClaimApprovedNotification(input: {
  claimRequest: ChurchClaimRequestRecord;
  church: ChurchRecord;
}) {
  await sendTransactionalEmail({
    to: input.claimRequest.requesterEmail,
    subject: "Your church access request has been approved",
    body: [
      `Your request to manage the listing for ${input.church.name} has been approved.`,
      "",
      "You will be able to help keep this church listing updated as we continue building the church representative portal.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });
}

export async function sendClaimDeniedNotification(input: {
  claimRequest: ChurchClaimRequestRecord;
  church: ChurchRecord;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.claimRequest.requesterEmail,
    subject: "Update regarding your church access request",
    body: [
      `Thank you for requesting access to the listing for ${input.church.name}.`,
      "",
      "At this time, we are unable to approve the request.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });
}

export async function sendClaimMoreInfoNotification(input: {
  claimRequest: ChurchClaimRequestRecord;
  church: ChurchRecord;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.claimRequest.requesterEmail,
    subject: "More information requested for your church access request",
    body: [
      `We need a little more information before we can review your request for ${input.church.name}.`,
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });
}

export async function sendClaimMessageNotification(input: {
  claimRequest: ChurchClaimRequestRecord;
  church: ChurchRecord;
  messageBody: string;
}) {
  await sendTransactionalEmail({
    to: input.claimRequest.requesterEmail,
    subject: "Message regarding your church access request",
    body: [
      `A message has been added regarding your request for ${input.church.name}.`,
      "",
      input.messageBody,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });
}

export async function sendRepresentativeUpdateSubmittedNotification(input: {
  church: ChurchRecord;
  representativeEmail: string;
  updateRequest: ChurchUpdateRequestRecord;
}) {
  await sendTransactionalEmail({
    to: input.representativeEmail,
    subject: "Your church listing updates were received",
    body: [
      `We received your updates for ${input.church.name}.`,
      "",
      "Your updates have been submitted for review. Please allow up to 24 hours for approval.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });

  const adminNotificationEmail = getAdminNotificationEmail();

  if (!adminNotificationEmail) {
    return;
  }

  await sendTransactionalEmail({
    to: adminNotificationEmail,
    subject: "Church listing updates pending approval",
    body: [
      "A church representative submitted listing updates that are waiting for review.",
      "",
      `Church name: ${input.church.name}`,
      `Representative email: ${input.representativeEmail}`,
      `Submitted at: ${input.updateRequest.createdAt}`,
      "",
      `Review it here: ${buildAbsoluteUrl(`/admin/updates/${input.updateRequest.id}`)}`,
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });
}

export async function sendRepresentativeUpdateAutoPublishedNotification(input: {
  church: ChurchRecord;
  representativeEmail: string;
  updateRequest: ChurchUpdateRequestRecord;
}) {
  await sendTransactionalEmail({
    to: input.representativeEmail,
    subject: "Your church listing has been updated",
    body: [
      "Your church listing has been updated.",
      "",
      "You can view the latest public listing here:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church.slug)),
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });

  const adminNotificationEmail = getAdminNotificationEmail();

  if (!adminNotificationEmail) {
    return;
  }

  await sendTransactionalEmail({
    to: adminNotificationEmail,
    subject: "Church listing updates were auto-published",
    body: [
      "A church representative updated a listing that is configured to auto-publish.",
      "",
      `Church name: ${input.church.name}`,
      `Representative email: ${input.representativeEmail}`,
      "",
      `View the listing: ${buildAbsoluteUrl(buildChurchProfilePath(input.church.slug))}`,
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });
}

export async function sendRepresentativeUpdateApprovedNotification(input: {
  church: ChurchRecord;
  representativeEmail: string;
  updateRequest: ChurchUpdateRequestRecord;
}) {
  await sendTransactionalEmail({
    to: input.representativeEmail,
    subject: "Your church listing updates were approved",
    body: [
      `Your updates for ${input.church.name} were approved and are now visible on Find Your Church Palacios.`,
      "",
      "You can view the listing here:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church.slug)),
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });
}

export async function sendRepresentativeUpdateDeniedNotification(input: {
  church: ChurchRecord;
  representativeEmail: string;
  updateRequest: ChurchUpdateRequestRecord;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.representativeEmail,
    subject: "Update regarding your church listing changes",
    body: [
      `Thank you for updating ${input.church.name} on Find Your Church Palacios.`,
      "",
      "At this time, we are unable to publish the changes as submitted.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });
}

export async function sendRepresentativeUpdateChangesRequestedNotification(input: {
  church: ChurchRecord;
  representativeEmail: string;
  updateRequest: ChurchUpdateRequestRecord;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.representativeEmail,
    subject: "Changes requested for your church listing updates",
    body: [
      `Thank you for updating ${input.church.name} on Find Your Church Palacios.`,
      "",
      "Before we can publish the listing changes, we need a few updates or clarifications.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Please respond with the needed information or submit an updated request.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });
}

export async function sendRepresentativeUpdateMessageNotification(input: {
  church: ChurchRecord;
  representativeEmail: string;
  updateRequest: ChurchUpdateRequestRecord;
  messageBody: string;
}) {
  await sendTransactionalEmail({
    to: input.representativeEmail,
    subject: "Message regarding your church listing updates",
    body: [
      `A message has been added regarding your update request for ${input.church.name}.`,
      "",
      input.messageBody,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });
}

export async function sendEditorInviteNotification(input: {
  church: ChurchRecord;
  representative: ChurchRepresentativeRecord;
}) {
  await sendTransactionalEmail({
    to: input.representative.email,
    subject: "You have been invited to help manage a church listing",
    body: [
      `You have been invited to help manage the listing for ${input.church.name} on Find Your Church Palacios.`,
      "",
      "Please sign in with this email address to accept access.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "churchRepresentative",
    relatedEntityId: input.representative.id,
  });
}

export async function sendOwnershipTransferRequestedNotification(input: {
  church: ChurchRecord;
  transferRequest: OwnershipTransferRequestRecord;
}) {
  const adminNotificationEmail = getAdminNotificationEmail();

  if (!adminNotificationEmail) {
    return;
  }

  await sendTransactionalEmail({
    to: adminNotificationEmail,
    subject: "Primary ownership transfer request pending review",
    body: [
      "A primary ownership transfer request was submitted from the representative portal.",
      "",
      `Church name: ${input.church.name}`,
      `Requested new owner: ${input.transferRequest.newOwnerName}`,
      `New owner email: ${input.transferRequest.newOwnerEmail}`,
      "",
      `Review it here: ${buildAbsoluteUrl(`/admin/churches/${input.church.id}/representatives`)}`,
    ].join("\n"),
    relatedEntityType: "ownershipTransferRequest",
    relatedEntityId: input.transferRequest.id,
  });
}

export async function sendOwnershipTransferApprovedNotification(input: {
  church: ChurchRecord;
  transferRequest: OwnershipTransferRequestRecord;
}) {
  await sendTransactionalEmail({
    to: input.transferRequest.newOwnerEmail,
    subject: "Your church access request has been approved",
    body: [
      `Primary ownership for ${input.church.name} has been approved for your account.`,
      "",
      "You can now access the church representative portal to help keep the listing updated.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "ownershipTransferRequest",
    relatedEntityId: input.transferRequest.id,
  });
}

export async function sendOwnershipTransferDeniedNotification(input: {
  church: ChurchRecord;
  transferRequest: OwnershipTransferRequestRecord;
  recipientEmail: string;
  adminMessage: string;
}) {
  await sendTransactionalEmail({
    to: input.recipientEmail,
    subject: "Update regarding your ownership transfer request",
    body: [
      `We are unable to approve the ownership transfer request for ${input.church.name} at this time.`,
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "ownershipTransferRequest",
    relatedEntityId: input.transferRequest.id,
  });
}

export async function sendRepresentativeChurchMessageNotification(input: {
  church: ChurchRecord;
  senderName: string;
  senderEmail: string;
  messageBody: string;
}) {
  const adminNotificationEmail = getAdminNotificationEmail();

  if (!adminNotificationEmail) {
    return;
  }

  await sendTransactionalEmail({
    to: adminNotificationEmail,
    subject: "New church representative message",
    body: [
      `A church representative sent a new message about ${input.church.name}.`,
      "",
      `Sender: ${input.senderName}`,
      `Sender email: ${input.senderEmail}`,
      "",
      input.messageBody,
      "",
      `Reply here: ${buildAbsoluteUrl(`/admin/churches/${input.church.id}/representatives`)}`,
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}

export async function sendAdminChurchMessageNotification(input: {
  church: ChurchRecord;
  recipientEmail: string;
  messageBody: string;
}) {
  await sendTransactionalEmail({
    to: input.recipientEmail,
    subject: "Message about your church listing",
    body: [
      `A message has been added regarding the listing for ${input.church.name}.`,
      "",
      input.messageBody,
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}

export async function sendAnnualListingVerificationNotification(input: {
  church: ChurchRecord;
  recipientEmail: string;
  acknowledgementUrl: string;
}) {
  await sendTransactionalEmail({
    to: input.recipientEmail,
    subject: "Please confirm your church listing is still active",
    body: [
      `We want to help keep the listing for ${input.church.name} accurate and active on Find Your Church Palacios.`,
      "",
      "If this listing is still active, please confirm it here:",
      input.acknowledgementUrl,
      "",
      "You do not need to make any edits unless something has changed. A simple confirmation lets us know the church is still active.",
      "",
      "If we do not receive a confirmation, we will begin a 14-day grace period before archiving the listing from the public directory.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}

export async function sendAnnualListingVerificationReminder7Notification(input: {
  church: ChurchRecord;
  recipientEmail: string;
  acknowledgementUrl: string;
}) {
  await sendTransactionalEmail({
    to: input.recipientEmail,
    subject: "Reminder: please confirm your church listing within 7 days",
    body: [
      `This is a reminder to confirm that the listing for ${input.church.name} is still active on Find Your Church Palacios.`,
      "",
      "Please confirm the listing here:",
      input.acknowledgementUrl,
      "",
      "If we do not hear back, the listing will be archived from the public directory in 7 days.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}

export async function sendAnnualListingVerificationReminder3Notification(input: {
  church: ChurchRecord;
  recipientEmail: string;
  acknowledgementUrl: string;
}) {
  await sendTransactionalEmail({
    to: input.recipientEmail,
    subject: "Final reminder: your church listing will be archived in 3 days",
    body: [
      `This is a final reminder for ${input.church.name}.`,
      "",
      "Please confirm the listing is still active here:",
      input.acknowledgementUrl,
      "",
      "If we do not receive a confirmation within 3 days, the listing will be archived from the public directory until it is reviewed again.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}

export async function sendAnnualListingArchivedNotification(input: {
  church: ChurchRecord;
  recipientEmail: string;
}) {
  await sendTransactionalEmail({
    to: input.recipientEmail,
    subject: "Your church listing has been archived",
    body: [
      `The listing for ${input.church.name} has been archived from the public directory because we did not receive an annual confirmation.`,
      "",
      "If the church is still active and you would like the listing restored, please contact us or submit a new update request through Find Your Church Palacios.",
      "",
      "Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.",
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}
