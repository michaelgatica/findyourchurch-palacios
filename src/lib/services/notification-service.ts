import {
  buildAbsoluteUrl,
  buildChurchProfilePath,
  siteConfig,
} from "@/lib/config/site";
import type {
  ChurchClaimRequestRecord,
  ChurchRecord,
  ChurchSubmissionRecord,
  ChurchUpdateRequestRecord,
  ChurchRepresentativeRecord,
  OwnershipTransferRequestRecord,
} from "@/lib/types/directory";

import { sendTransactionalEmail } from "@/lib/services/email-service";
import { getAdminNotificationEmails } from "@/lib/services/email-service";
import { formatDateTime } from "@/lib/formatting";

function getPortalUrl() {
  return buildAbsoluteUrl("/portal");
}

function getMissionNote() {
  return [
    `${siteConfig.launchName} is a ministry project created by ${siteConfig.ministryName} to help churches be searchable, visible, and easier to connect with. ${siteConfig.ministryName} exists to equip churches, ministries, and community programs with digital tools that support communication, outreach, and ministry effectiveness.`,
  ];
}

function getDonationNote() {
  return [
    `${siteConfig.launchName} is provided at no charge to churches that may not be able to afford another monthly or yearly platform. Donations are welcomed and appreciated because there are ongoing costs to operate and maintain this site. To support this work, visit ${siteConfig.ministryDonationUrl}.`,
  ];
}

function getAdminOnlyMinistryNote() {
  return [
    `${siteConfig.launchName} is a ministry project created and maintained by ${siteConfig.ministryName}.`,
  ];
}

function getMissionAndDonationNote() {
  return [...getMissionNote(), "", ...getDonationNote()];
}

async function sendAdminNotificationEmail(input: {
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const recipients = getAdminNotificationEmails();

  if (recipients.length === 0) {
    return;
  }

  await Promise.all(
    recipients.map((recipientEmail) =>
      sendTransactionalEmail({
        to: recipientEmail,
        subject: input.subject,
        body: input.body,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      }),
    ),
  );
}

export async function queueSubmissionReceivedNotification(
  submission: ChurchSubmissionRecord,
) {
  const accountCreatedMessage = submission.requestedManagerAccount
    ? [
        "",
        `We also created a Find Your Church account for ${submission.requestedManagerAccount.email}. Once the listing is approved, that account can be connected as the listing manager so your church can help keep this page updated.`,
      ]
    : [];

  await sendTransactionalEmail({
    to: submission.submitterEmail,
    subject: "We received your church listing submission",
    body: [
      `Thank you for submitting your church to ${siteConfig.launchName}.`,
      "",
      `We received the listing for ${submission.churchDraft.name} and will review it for accuracy before it is published. Please allow up to 24 hours for review. If we need clarification or suggested edits, we will contact you using the information provided.`,
      ...accountCreatedMessage,
      "",
      ...getMissionAndDonationNote(),
    ].join("\n"),
    relatedEntityType: "churchSubmission",
    relatedEntityId: submission.id,
  });

  await sendAdminNotificationEmail({
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
      `Submission time: ${formatDateTime(submission.submittedAt ?? submission.createdAt)}`,
      "",
      "Review it here:",
      buildAbsoluteUrl(`/admin/submissions/${submission.id}`),
      "",
      ...getAdminOnlyMinistryNote(),
    ]
      .filter(Boolean)
      .join("\n"),
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
      `Good news - the listing for ${input.church.name} has been approved and is now available on ${siteConfig.launchName}.`,
      "",
      "You can view the listing here:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church)),
      ...(input.managerAccountAssigned && input.submission.requestedManagerAccount
        ? [
            "",
            `The Find Your Church account for ${input.submission.requestedManagerAccount.email} can now sign in to help manage this listing and keep the church information updated.`,
          ]
        : []),
      "",
      `Thank you for helping keep local church information accurate, helpful, and easy to find for residents, visitors, and families in ${siteConfig.launchAreaLabel}.`,
      "",
      ...getMissionAndDonationNote(),
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
      `Thank you for submitting ${input.submission.churchDraft.name} to ${siteConfig.launchName}.`,
      "",
      "At this time, we are unable to publish the listing as submitted.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "If you believe this was in error or would like to submit corrected information, please contact us or submit a new request. We are glad to help keep church information accurate and useful for the community.",
      "",
      ...getMissionNote(),
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
      `Thank you for submitting ${input.submission.churchDraft.name} to ${siteConfig.launchName}.`,
      "",
      "Before we can publish the listing, we need a few updates or clarifications.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Please respond with the needed information or submit an updated request. Once the information is complete, we will review it again as soon as possible.",
      "",
      ...getMissionNote(),
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
      `A message has been added regarding the submission for ${input.submission.churchDraft.name}.`,
      "",
      "Message:",
      input.messageBody,
      "",
      "Please respond if additional information is needed.",
      "",
      ...getMissionNote(),
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
      "Your request has been received and will be reviewed for accuracy and authorization. Please allow up to 24 hours for review. We will notify you by email when the request is approved, denied, or if we need any additional information.",
      "",
      ...getMissionAndDonationNote(),
    ].join("\n"),
    relatedEntityType: "churchClaimRequest",
    relatedEntityId: input.claimRequest.id,
  });

  await sendAdminNotificationEmail({
    subject: "New church claim request pending review",
    body: [
      "A church claim request is waiting for review in the Find Your Church admin portal.",
      "",
      `Church name: ${input.church.name}`,
      `Requester name: ${input.claimRequest.requesterName}`,
      `Requester email: ${input.claimRequest.requesterEmail}`,
      `Request time: ${formatDateTime(input.claimRequest.createdAt)}`,
      "",
      "Review it here:",
      buildAbsoluteUrl(`/admin/claims/${input.claimRequest.id}`),
      "",
      ...getAdminOnlyMinistryNote(),
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
      `Your request to help manage the listing for ${input.church.name} has been approved.`,
      "",
      "You may now sign in to the church representative portal to help keep the listing accurate and up to date.",
      "",
      "Portal:",
      getPortalUrl(),
      "",
      "Thank you for helping make local church information easier to find and trust.",
      "",
      ...getMissionAndDonationNote(),
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
      "If you believe this was in error or have additional information that may help verify your connection to the church, please contact us or submit a new request.",
      "",
      ...getMissionNote(),
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
      `Thank you for requesting access to help manage the listing for ${input.church.name}.`,
      "",
      "Before we can complete the review, we need a little more information.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Please respond with the requested information so we can continue reviewing your request.",
      "",
      ...getMissionNote(),
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
      `A message has been added regarding your access request for ${input.church.name}.`,
      "",
      "Message:",
      input.messageBody,
      "",
      "Please respond if additional information is needed.",
      "",
      ...getMissionNote(),
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
      "The updates have been submitted for review. Please allow up to 24 hours for approval. If we need any clarification, we will contact you.",
      "",
      "Thank you for helping keep this church listing accurate for residents, visitors, and families looking for a church community.",
      "",
      ...getMissionAndDonationNote(),
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });

  await sendAdminNotificationEmail({
    subject: "Church listing updates pending approval",
    body: [
      "A church representative submitted listing updates that are waiting for review.",
      "",
      `Church name: ${input.church.name}`,
      `Representative email: ${input.representativeEmail}`,
      `Submitted at: ${formatDateTime(input.updateRequest.createdAt)}`,
      "",
      "Review it here:",
      buildAbsoluteUrl(`/admin/updates/${input.updateRequest.id}`),
      "",
      ...getAdminOnlyMinistryNote(),
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
      `Your listing for ${input.church.name} has been updated.`,
      "",
      "You can view the latest public listing here:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church)),
      "",
      "Thank you for helping keep local church information accurate and easy to find.",
      "",
      ...getMissionAndDonationNote(),
    ].join("\n"),
    relatedEntityType: "churchUpdateRequest",
    relatedEntityId: input.updateRequest.id,
  });

  await sendAdminNotificationEmail({
    subject: "Church listing updates were auto-published",
    body: [
      "A church representative updated a listing that is configured to auto-publish.",
      "",
      `Church name: ${input.church.name}`,
      `Representative email: ${input.representativeEmail}`,
      "",
      "View the listing:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church)),
      "",
      ...getAdminOnlyMinistryNote(),
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
      `Your updates for ${input.church.name} have been approved and are now visible on ${siteConfig.launchName}.`,
      "",
      "You can view the listing here:",
      buildAbsoluteUrl(buildChurchProfilePath(input.church)),
      "",
      "Thank you for helping keep your church information accurate and helpful for the community.",
      "",
      ...getMissionAndDonationNote(),
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
      `Thank you for submitting updates for ${input.church.name} on ${siteConfig.launchName}.`,
      "",
      "At this time, we are unable to publish the changes as submitted.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "If you believe this was in error or would like to submit corrected information, please respond or submit a new update request.",
      "",
      ...getMissionNote(),
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
      `Thank you for submitting updates for ${input.church.name} on ${siteConfig.launchName}.`,
      "",
      "Before we can publish the listing changes, we need a few updates or clarifications.",
      "",
      "Message from the review team:",
      input.adminMessage,
      "",
      "Please respond with the needed information or submit an updated request. Once the information is complete, we will review it again as soon as possible.",
      "",
      ...getMissionNote(),
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
      "Message:",
      input.messageBody,
      "",
      "Please respond if additional information is needed.",
      "",
      ...getMissionNote(),
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
      `You have been invited to help manage the listing for ${input.church.name} on ${siteConfig.launchName}.`,
      "",
      "Please sign in using this email address to accept access:",
      getPortalUrl(),
      "",
      "Once accepted, you can help keep the church listing accurate and up to date.",
      "",
      ...getMissionNote(),
    ].join("\n"),
    relatedEntityType: "churchRepresentative",
    relatedEntityId: input.representative.id,
  });
}

export async function sendOwnershipTransferRequestedNotification(input: {
  church: ChurchRecord;
  transferRequest: OwnershipTransferRequestRecord;
}) {
  await sendAdminNotificationEmail({
    subject: "Primary ownership transfer request pending review",
    body: [
      "A primary ownership transfer request was submitted from the church representative portal.",
      "",
      `Church name: ${input.church.name}`,
      `Requested new owner: ${input.transferRequest.newOwnerName}`,
      `New owner email: ${input.transferRequest.newOwnerEmail}`,
      "",
      "Review it here:",
      buildAbsoluteUrl(`/admin/churches/${input.church.id}/representatives`),
      "",
      ...getAdminOnlyMinistryNote(),
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
    subject: "Primary listing management access has been approved",
    body: [
      `Primary listing management access for ${input.church.name} has been transferred to your account.`,
      "",
      "You are now the primary representative responsible for helping keep this church listing accurate.",
      "",
      "You can now sign in to the church representative portal to help keep this listing accurate and up to date.",
      "",
      "Portal:",
      getPortalUrl(),
      "",
      ...getMissionNote(),
    ].join("\n"),
    relatedEntityType: "ownershipTransferRequest",
    relatedEntityId: input.transferRequest.id,
  });
}

export async function sendOwnershipTransferPreviousOwnerNotification(input: {
  church: ChurchRecord;
  previousOwnerEmail: string;
  previousOwnerName?: string;
  transferRequest: OwnershipTransferRequestRecord;
}) {
  await sendTransactionalEmail({
    to: input.previousOwnerEmail,
    subject: "Primary listing management access has been transferred",
    body: [
      input.previousOwnerName
        ? `Hello ${input.previousOwnerName},`
        : "Hello,",
      "",
      `Primary listing management access for ${input.church.name} has been transferred to ${input.transferRequest.newOwnerName} (${input.transferRequest.newOwnerEmail}).`,
      "",
      `If this change was made in error or you need help, please contact ${siteConfig.contactEmail}.`,
      "",
      ...getMissionNote(),
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
      "If you believe this was in error or would like to provide additional information, please contact us.",
      "",
      ...getMissionNote(),
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
  await sendAdminNotificationEmail({
    subject: "New church representative message",
    body: [
      "A church representative sent a new message through the Find Your Church portal.",
      "",
      `Church name: ${input.church.name}`,
      `Sender: ${input.senderName}`,
      `Sender email: ${input.senderEmail}`,
      "",
      "Message:",
      input.messageBody,
      "",
      "Reply here:",
      buildAbsoluteUrl(`/admin/churches/${input.church.id}/representatives`),
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
      "Message:",
      input.messageBody,
      "",
      "Please sign in to the church representative portal if a response or update is needed:",
      getPortalUrl(),
      "",
      ...getMissionNote(),
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
      `We want to help keep the listing for ${input.church.name} accurate and active on ${siteConfig.launchName}.`,
      "",
      "If this listing is still active, please confirm it here:",
      input.acknowledgementUrl,
      "",
      "You do not need to make edits unless something has changed. A simple confirmation lets us know the church is still active and that the information can remain public.",
      "",
      "If we do not receive a confirmation, we will begin a 14-day grace period before archiving the listing from the public directory.",
      "",
      `If your listing is archived by mistake or you need help restoring it, please contact ${siteConfig.contactEmail}.`,
      "",
      ...getMissionAndDonationNote(),
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
      `This is a reminder to confirm that the listing for ${input.church.name} is still active on ${siteConfig.launchName}.`,
      "",
      "Please confirm the listing here:",
      input.acknowledgementUrl,
      "",
      "If we do not receive confirmation, the listing will be archived from the public directory in 7 days. Archiving helps us avoid showing outdated information to people looking for a local church.",
      "",
      `If your listing is archived by mistake or you need help restoring it, please contact ${siteConfig.contactEmail}.`,
      "",
      ...getMissionAndDonationNote(),
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
      `This is a final reminder to confirm that the listing for ${input.church.name} is still active on ${siteConfig.launchName}.`,
      "",
      "Please confirm the listing is still active here:",
      input.acknowledgementUrl,
      "",
      "If we do not receive confirmation within 3 days, the listing will be archived from the public directory until it is reviewed again. This helps keep the directory accurate for residents, visitors, and families looking for a church community.",
      "",
      `If your listing is archived by mistake or you need help restoring it, please contact ${siteConfig.contactEmail}.`,
      "",
      ...getMissionAndDonationNote(),
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
      `If the church is still active and you would like the listing restored, please contact ${siteConfig.contactEmail} or submit a new update request through ${siteConfig.launchName}. We will be glad to review and restore accurate information.`,
      "",
      ...getMissionNote(),
    ].join("\n"),
    relatedEntityType: "church",
    relatedEntityId: input.church.id,
  });
}
