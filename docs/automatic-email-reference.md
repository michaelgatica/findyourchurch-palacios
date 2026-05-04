# Automatic Email Reference

This document lists the automatic emails currently wired into Find Your Church Palacios so copy, timing, recipients, and sender behavior can be reviewed before launch.

## Global sender and recipient rules

- Default sender: `EMAIL_FROM`
- Current intended production sender: `support@findyourchurchpalacios.org`
- Admin workflow recipients: `ADMIN_NOTIFICATION_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL` can be one inbox or a comma-separated list
- Example admin inbox setup:
  - `support@findyourchurchpalacios.org,support@elroidigital.org`
- Every attempted email also writes a record to the `emailLogs` collection

## Review notes

When editing this document, the easiest fields to change are usually:

- subject line
- body copy
- who should receive the email
- whether the email should still be automatic or only sent in certain cases

---

## 1. Church submission workflow

### 1.1 Submission received confirmation

- Trigger: immediately after a public church submission is saved successfully
- From: `EMAIL_FROM`
- To: the public submitter email
- Subject: `We received your church listing submission`

Current body:

```text
Thank you for submitting your church to Find Your Church Palacios. We received your listing and will review it for accuracy before publishing. Please allow up to 24 hours for approval.

If we need any clarification or edits, we will contact you.

[Optional paragraph if a manager account was created:]
We also created a Find Your Church account for [Manager Email]. Once the listing is approved, that account can be connected as the listing manager so the church can keep this page updated.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries. Our desire is to help churches be searchable, visible, and easy to connect with.
```

### 1.2 New church listing pending approval

- Trigger: immediately after a public church submission is saved successfully
- From: `EMAIL_FROM`
- To: every address in `ADMIN_NOTIFICATION_EMAIL`
- Subject: `New church listing pending approval`

Current body:

```text
A new church listing has been submitted and is waiting for review in the Find Your Church admin portal.

Church name: [Church Name]
Submitter name: [Submitter Name]
Submitter email: [Submitter Email]
[Optional line if a manager account was requested:]
Manager account requested: [Manager Account Email]
Submission time: [Submission Time]

Review it here: [Admin Submission Review URL]
```

### 1.3 Submission approved

- Trigger: when an admin approves a church submission
- From: `EMAIL_FROM`
- To: the public submitter email
- Subject: `Your church listing has been approved`

Current body:

```text
Your church listing for [Church Name] has been approved and is now listed on Find Your Church Palacios.

You can view the listing here:
[Church Profile URL]

[Optional paragraph if a requested manager account was assigned:]
The Find Your Church account for [Manager Account Email] can now sign in to help manage this listing.

Thank you for helping us keep local church information accurate and easy to find.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 1.4 Submission denied

- Trigger: when an admin denies a church submission
- From: `EMAIL_FROM`
- To: the public submitter email
- Subject: `Update regarding your church listing submission`

Current body:

```text
Thank you for submitting [Church Name] to Find Your Church Palacios.

At this time, we are unable to publish the listing as submitted.

Message from the review team:
[Admin Message]

If you believe this was in error or would like to submit corrected information, please contact us or submit a new request.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 1.5 Submission changes requested

- Trigger: when an admin requests changes on a church submission
- From: `EMAIL_FROM`
- To: the public submitter email
- Subject: `Changes requested for your church listing`

Current body:

```text
Thank you for submitting [Church Name] to Find Your Church Palacios.

Before we can publish the listing, we need a few updates or clarifications.

Message from the review team:
[Admin Message]

Please respond with the needed information or submit an updated request.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 1.6 Submission message notification

- Trigger: when an admin sends a public message about a church submission
- From: `EMAIL_FROM`
- To: the public submitter email
- Subject: `Message regarding your church listing submission`

Current body:

```text
A message has been added regarding your submission for [Church Name].

[Message Body]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

---

## 2. Church claim workflow

### 2.1 Claim request received confirmation

- Trigger: immediately after a signed-in user submits a church claim request
- From: `EMAIL_FROM`
- To: the claim requester email
- Subject: `We received your church access request`

Current body:

```text
Thank you for requesting access to help manage the listing for [Church Name].

Your request has been received. Please allow up to 24 hours for review.
We will notify you by email as soon as the review team approves the request or if we need any additional information.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 2.2 New church claim request pending review

- Trigger: immediately after a signed-in user submits a church claim request
- From: `EMAIL_FROM`
- To: every address in `ADMIN_NOTIFICATION_EMAIL`
- Subject: `New church claim request pending review`

Current body:

```text
A church claim request is waiting for review in the Find Your Church admin portal.

Church name: [Church Name]
Requester name: [Requester Name]
Requester email: [Requester Email]
Request time: [Created At]

Review it here: [Admin Claim Review URL]
```

### 2.3 Claim approved

- Trigger: when an admin approves a church claim request
- From: `EMAIL_FROM`
- To: the claim requester email
- Subject: `Your church access request has been approved`

Current body:

```text
Your request to manage the listing for [Church Name] has been approved.

You will be able to help keep this church listing updated as we continue building the church representative portal.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 2.4 Claim denied

- Trigger: when an admin denies a church claim request
- From: `EMAIL_FROM`
- To: the claim requester email
- Subject: `Update regarding your church access request`

Current body:

```text
Thank you for requesting access to the listing for [Church Name].

At this time, we are unable to approve the request.

Message from the review team:
[Admin Message]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 2.5 Claim more information requested

- Trigger: when an admin requests more information on a church claim request
- From: `EMAIL_FROM`
- To: the claim requester email
- Subject: `More information requested for your church access request`

Current body:

```text
We need a little more information before we can review your request for [Church Name].

Message from the review team:
[Admin Message]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 2.6 Claim message notification

- Trigger: when an admin sends a public message about a church claim request
- From: `EMAIL_FROM`
- To: the claim requester email
- Subject: `Message regarding your church access request`

Current body:

```text
A message has been added regarding your request for [Church Name].

[Message Body]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

---

## 3. Representative church update workflow

### 3.1 Representative update received confirmation

- Trigger: when a representative submits an update request for a church that requires admin review
- From: `EMAIL_FROM`
- To: the representative email
- Subject: `Your church listing updates were received`

Current body:

```text
We received your updates for [Church Name].

Your updates have been submitted for review. Please allow up to 24 hours for approval.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 3.2 Church listing updates pending approval

- Trigger: when a representative submits an update request for a church that requires admin review
- From: `EMAIL_FROM`
- To: every address in `ADMIN_NOTIFICATION_EMAIL`
- Subject: `Church listing updates pending approval`

Current body:

```text
A church representative submitted listing updates that are waiting for review.

Church name: [Church Name]
Representative email: [Representative Email]
Submitted at: [Created At]

Review it here: [Admin Update Review URL]
```

### 3.3 Representative update auto-published confirmation

- Trigger: when a representative updates a church with `autoPublishUpdates=true`
- From: `EMAIL_FROM`
- To: the representative email
- Subject: `Your church listing has been updated`

Current body:

```text
Your church listing has been updated.

You can view the latest public listing here:
[Church Profile URL]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 3.4 Church listing updates were auto-published

- Trigger: when a representative updates a church with `autoPublishUpdates=true`
- From: `EMAIL_FROM`
- To: every address in `ADMIN_NOTIFICATION_EMAIL`
- Subject: `Church listing updates were auto-published`

Current body:

```text
A church representative updated a listing that is configured to auto-publish.

Church name: [Church Name]
Representative email: [Representative Email]

View the listing: [Church Profile URL]
```

### 3.5 Representative update approved

- Trigger: when an admin approves a representative update request
- From: `EMAIL_FROM`
- To: the representative email
- Subject: `Your church listing updates were approved`

Current body:

```text
Your updates for [Church Name] were approved and are now visible on Find Your Church Palacios.

You can view the listing here:
[Church Profile URL]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 3.6 Representative update denied

- Trigger: when an admin denies a representative update request
- From: `EMAIL_FROM`
- To: the representative email
- Subject: `Update regarding your church listing changes`

Current body:

```text
Thank you for updating [Church Name] on Find Your Church Palacios.

At this time, we are unable to publish the changes as submitted.

Message from the review team:
[Admin Message]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 3.7 Representative update changes requested

- Trigger: when an admin requests changes on a representative update request
- From: `EMAIL_FROM`
- To: the representative email
- Subject: `Changes requested for your church listing updates`

Current body:

```text
Thank you for updating [Church Name] on Find Your Church Palacios.

Before we can publish the listing changes, we need a few updates or clarifications.

Message from the review team:
[Admin Message]

Please respond with the needed information or submit an updated request.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 3.8 Representative update message notification

- Trigger: when an admin sends a public message about a representative update request
- From: `EMAIL_FROM`
- To: the representative email
- Subject: `Message regarding your church listing updates`

Current body:

```text
A message has been added regarding your update request for [Church Name].

[Message Body]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

---

## 4. Representative team and ownership workflow

### 4.1 Editor invite

- Trigger: when a primary representative invites one editor
- From: `EMAIL_FROM`
- To: the invited editor email
- Subject: `You have been invited to help manage a church listing`

Current body:

```text
You have been invited to help manage the listing for [Church Name] on Find Your Church Palacios.

Please sign in with this email address to accept access.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 4.2 Ownership transfer requested

- Trigger: when a primary representative submits an ownership transfer request
- From: `EMAIL_FROM`
- To: every address in `ADMIN_NOTIFICATION_EMAIL`
- Subject: `Primary ownership transfer request pending review`

Current body:

```text
A primary ownership transfer request was submitted from the representative portal.

Church name: [Church Name]
Requested new owner: [New Owner Name]
New owner email: [New Owner Email]

Review it here: [Admin Representatives Review URL]
```

### 4.3 Ownership transfer approved

- Trigger: when an admin approves an ownership transfer request
- From: `EMAIL_FROM`
- To: the approved new owner email
- Subject: `Your church access request has been approved`

Current body:

```text
Primary ownership for [Church Name] has been approved for your account.

You can now access the church representative portal to help keep the listing updated.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 4.4 Ownership transfer denied

- Trigger: when an admin denies an ownership transfer request
- From: `EMAIL_FROM`
- To: the specified recipient email for the denial
- Subject: `Update regarding your ownership transfer request`

Current body:

```text
We are unable to approve the ownership transfer request for [Church Name] at this time.

Message from the review team:
[Admin Message]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

---

## 5. Admin and representative messaging workflow

### 5.1 New church representative message

- Trigger: when a representative sends a message to admin from the portal
- From: `EMAIL_FROM`
- To: every address in `ADMIN_NOTIFICATION_EMAIL`
- Subject: `New church representative message`

Current body:

```text
A church representative sent a new message about [Church Name].

Sender: [Sender Name]
Sender email: [Sender Email]

[Message Body]

Reply here: [Admin Representatives Review URL]
```

### 5.2 Message about your church listing

- Trigger: when an admin sends a church-level message to a representative
- From: `EMAIL_FROM`
- To: the representative recipient email
- Subject: `Message about your church listing`

Current body:

```text
A message has been added regarding the listing for [Church Name].

[Message Body]

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

---

## 6. Annual listing verification workflow

### 6.1 Annual verification request

- Trigger: after one year with no qualifying listing activity
- From: `EMAIL_FROM`
- To: the listing verification recipient email
- Subject: `Please confirm your church listing is still active`

Current body:

```text
We want to help keep the listing for [Church Name] accurate and active on Find Your Church Palacios.

If this listing is still active, please confirm it here:
[Acknowledgement URL]

You do not need to make any edits unless something has changed. A simple confirmation lets us know the church is still active.

If we do not receive a confirmation, we will begin a 14-day grace period before archiving the listing from the public directory.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 6.2 7-day annual verification reminder

- Trigger: 7 days before the listing will be archived during the grace period
- From: `EMAIL_FROM`
- To: the listing verification recipient email
- Subject: `Reminder: please confirm your church listing within 7 days`

Current body:

```text
This is a reminder to confirm that the listing for [Church Name] is still active on Find Your Church Palacios.

Please confirm the listing here:
[Acknowledgement URL]

If we do not hear back, the listing will be archived from the public directory in 7 days.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 6.3 3-day annual verification reminder

- Trigger: 3 days before the listing will be archived during the grace period
- From: `EMAIL_FROM`
- To: the listing verification recipient email
- Subject: `Final reminder: your church listing will be archived in 3 days`

Current body:

```text
This is a final reminder for [Church Name].

Please confirm the listing is still active here:
[Acknowledgement URL]

If we do not receive a confirmation within 3 days, the listing will be archived from the public directory until it is reviewed again.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

### 6.4 Listing archived

- Trigger: after the grace period expires without acknowledgement
- From: `EMAIL_FROM`
- To: the listing verification recipient email
- Subject: `Your church listing has been archived`

Current body:

```text
The listing for [Church Name] has been archived from the public directory because we did not receive an annual confirmation.

If the church is still active and you would like the listing restored, please contact us or submit a new update request through Find Your Church Palacios.

Find Your Church Palacios is a ministry project powered by El Roi Digital Ministries.
```

---

## 7. Utility email

### 7.1 Email test

- Trigger: only when someone intentionally runs `npm run test:email`
- From: `EMAIL_FROM`
- To: `TEST_EMAIL_TO`, or `ADMIN_NOTIFICATION_EMAIL`, or the site contact email fallback
- Subject: `Find Your Church email test ([Provider])`

Current body:

```text
This is a Find Your Church Palacios email test.

Provider: [Provider]
From: [From Address]
Recipient: [Recipient Email]

If you received this unexpectedly, please review the email provider configuration before launch.
```

This email is not part of normal public or church workflows. It exists only for verification of the email provider setup.

---

## Suggested review questions

- Do any subject lines feel too formal, too technical, or too abrupt?
- Should admin emails always go to both ministry inboxes?
- Should any emails also CC another address?
- Should any messages be shortened for mobile readability?
- Do any approval or denial emails need softer pastoral wording?
- Should the annual verification emails mention a specific restoration contact email?
- Should the ownership transfer emails have different wording from claim approval emails?
