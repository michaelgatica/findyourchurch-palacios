import assert from "node:assert/strict";

import nodemailer from "nodemailer";

import {
  createEmailRenderings,
  getAdminNotificationEmails,
  getEmailConfigurationProblems,
} from "@/lib/services/email-service";

const expectedProjectId = "findyourchurch-24562";
const expectedFrom = "noreply@findyourchurchpalacios.org";
const expectedReplyTo = "support@findyourchurchpalacios.org";
const expectedRecipients = [
  "support@elroidigital.org",
  "support@findyourchurchpalacios.org",
] as const;

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assertExactEnvironmentValue(name: string, expected: string) {
  assert.equal(
    requiredEnvironmentValue(name),
    expected,
    `${name} must identify the approved production configuration.`,
  );
}

function redactProviderValue(value: unknown) {
  const secretValues = [process.env.SMTP_PASSWORD, process.env.SMTP_USER]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return secretValues
    .reduce((message, secret) => message.replaceAll(secret, "[redacted]"), String(value ?? ""))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .slice(0, 300);
}

async function run() {
  assertExactEnvironmentValue("PRODUCTION_FIREBASE_PROJECT_ID", expectedProjectId);
  assertExactEnvironmentValue("EMAIL_PROVIDER", "smtp");
  assertExactEnvironmentValue("EMAIL_FROM", expectedFrom);
  assertExactEnvironmentValue("SMTP_USER", expectedFrom);
  assertExactEnvironmentValue("SMTP_REPLY_TO", expectedReplyTo);
  assertExactEnvironmentValue("ALLOW_REAL_EMAIL_TEST", "true");

  const sessionId = requiredEnvironmentValue("EMAIL_FORWARDING_TEST_SESSION_ID");
  assert.match(sessionId, /^[a-z0-9-]{8,64}$/i, "EMAIL_FORWARDING_TEST_SESSION_ID is invalid.");

  const configuredRecipients = getAdminNotificationEmails().toSorted();
  assert.deepEqual(
    configuredRecipients,
    [...expectedRecipients],
    "Admin notification recipients changed.",
  );
  const requestedRecipient = process.env.EMAIL_FORWARDING_TEST_ONLY_RECIPIENT?.trim().toLowerCase();
  assert.ok(
    !requestedRecipient || new Set<string>(configuredRecipients).has(requestedRecipient),
    "EMAIL_FORWARDING_TEST_ONLY_RECIPIENT must be a configured admin notification recipient.",
  );
  const recipients = requestedRecipient ? [requestedRecipient] : configuredRecipients;

  const configurationProblems = getEmailConfigurationProblems("smtp");
  assert.deepEqual(configurationProblems, [], configurationProblems.join(" "));

  const smtpHost = requiredEnvironmentValue("SMTP_HOST");
  const smtpPort = Number(requiredEnvironmentValue("SMTP_PORT"));
  const smtpPassword = requiredEnvironmentValue("SMTP_PASSWORD");
  assert.ok(Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: expectedFrom,
      pass: smtpPassword,
    },
  });

  const evidence: Array<{
    recipientLabel: string;
    accepted: number;
    rejected: number;
    messageId: string;
  }> = [];

  try {
    await transporter.verify();

    for (const [index, recipient] of recipients.entries()) {
      const renderings = createEmailRenderings([
        "Controlled production email-routing test. No church claim was created, and no approval action is required.",
        "",
        "Workflow under test: pending church claim approval notification.",
        `Routing marker: recipient-${index + 1}`,
        `Verification session: ${sessionId}`,
        "",
        "This message is being sent only to confirm that the configured support mailbox forwards operational approval notifications to the launch owner's Gmail inbox.",
      ].join("\n"));
      const result = await transporter.sendMail({
        from: `Find Your Church Palacios <${expectedFrom}>`,
        to: recipient,
        replyTo: expectedReplyTo,
        subject: `[FYC forwarding test ${sessionId}] Pending approval notification delivery check`,
        text: renderings.text,
        html: renderings.html,
      });

      assert.deepEqual(result.rejected, []);
      assert.equal(result.accepted.length, 1, `Forwarding test recipient ${index + 1} was not accepted.`);
      evidence.push({
        recipientLabel: `admin-notification-recipient-${index + 1}`,
        accepted: result.accepted.length,
        rejected: result.rejected.length,
        messageId: redactProviderValue(result.messageId),
      });
    }

    console.log(JSON.stringify({
      ok: true,
      suite: "admin-notification-forwarding",
      sessionId,
      smtpConnectionVerified: true,
      configuredRecipients: configuredRecipients.length,
      testedRecipients: recipients.length,
      acceptedMessages: evidence.reduce((sum, item) => sum + item.accepted, 0),
      rejectedMessages: evidence.reduce((sum, item) => sum + item.rejected, 0),
      evidence,
      secretsPrinted: false,
    }, null, 2));
  } finally {
    transporter.close();
  }
}

run().catch((error) => {
  console.error(redactProviderValue(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
