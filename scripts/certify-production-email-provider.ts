import assert from "node:assert/strict";

import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import { PDFDocument } from "pdf-lib";

import {
  createEmailRenderings,
  getEmailConfigurationProblems,
  type EmailAttachment,
} from "@/lib/services/email-service";
import {
  createStagingEmailMessage,
  stagingEmailTemplateDefinitions,
} from "@/lib/services/staging-email-test-service";

const expectedProjectId = "findyourchurch-24562";
const expectedDatabaseId = "findyourchurchpal";
const expectedSiteUrl = "https://findyourchurchpalacios.org";
const expectedRecipient = "michaelgatica@gmail.com";
const expectedFrom = "noreply@findyourchurchpalacios.org";
const expectedReplyTo = "support@findyourchurchpalacios.org";
const invalidBounceDomain = "example.invalid";

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assertExactEnvironmentValue(name: string, expected: string) {
  assert.equal(
    requiredEnvironmentValue(name),
    expected,
    `${name} must identify the approved production target.`,
  );
}

function redactProviderResponse(value: unknown) {
  const secretValues = [process.env.SMTP_PASSWORD, process.env.SMTP_USER]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  return secretValues
    .reduce((message, secret) => message.replaceAll(secret, "[redacted]"), String(value ?? ""))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .slice(0, 500);
}

async function validateAttachments(
  attachments: EmailAttachment[],
) {
  const result: Array<{ filename: string; bytes: number; type: string }> = [];

  for (const attachment of attachments ?? []) {
    if (attachment.contentType === "application/pdf") {
      const document = await PDFDocument.load(attachment.content);
      assert.ok(document.getPageCount() > 0, `${attachment.filename} has no PDF pages.`);
    }

    if (attachment.contentType.includes("spreadsheetml")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(attachment.content as never);
      assert.ok(workbook.worksheets.length >= 2, `${attachment.filename} lacks report sheets.`);
    }

    result.push({
      filename: attachment.filename,
      bytes: attachment.content.byteLength,
      type: attachment.contentType,
    });
  }

  return result;
}

async function run() {
  assertExactEnvironmentValue("FIREBASE_PROJECT_ID", expectedProjectId);
  assertExactEnvironmentValue("PRODUCTION_FIREBASE_PROJECT_ID", expectedProjectId);
  assertExactEnvironmentValue("FIREBASE_DATABASE_ID", expectedDatabaseId);
  assertExactEnvironmentValue("NEXT_PUBLIC_SITE_URL", expectedSiteUrl);
  assertExactEnvironmentValue("TEST_EMAIL_TO", expectedRecipient);
  assertExactEnvironmentValue("EMAIL_FROM", expectedFrom);
  assertExactEnvironmentValue("SMTP_USER", expectedFrom);
  assertExactEnvironmentValue("SMTP_REPLY_TO", expectedReplyTo);
  assertExactEnvironmentValue("EMAIL_PROVIDER", "smtp");
  assertExactEnvironmentValue("ALLOW_REAL_EMAIL_TEST", "true");

  const sessionId = requiredEnvironmentValue("EMAIL_CERTIFICATION_SESSION_ID");
  assert.match(sessionId, /^[a-z0-9-]{8,64}$/i, "EMAIL_CERTIFICATION_SESSION_ID is invalid.");

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
    auth: { user: expectedFrom, pass: smtpPassword },
  });

  await transporter.verify();

  const sent: Array<{
    template: string;
    subject: string;
    accepted: number;
    rejected: number;
    messageId: string;
    attachments: Array<{ filename: string; bytes: number; type: string }>;
  }> = [];

  try {
    for (const definition of stagingEmailTemplateDefinitions) {
      const message = await createStagingEmailMessage(definition.key);
      const links = message.body.match(/https?:\/\/[^\s)]+/g) ?? [];
      assert.equal(
        links.every((url) => new URL(url).origin === expectedSiteUrl),
        true,
        `${definition.key} contains a nonproduction link.`,
      );
      assert.equal(/allergy|medical|emergency[- ]contact|child answer/i.test(message.body), false);

      const attachments = "attachments" in message ? message.attachments ?? [] : [];
      const attachmentEvidence = await validateAttachments(attachments);
      const subject = `[FYC prelaunch ${sessionId}] ${message.subject}`;
      const renderings = createEmailRenderings([
        `Controlled production-provider certification for ${definition.label}.`,
        "",
        message.body,
      ].join("\n"));
      assert.match(renderings.text, /This mailbox is not monitored\./);
      assert.match(renderings.text, /support@findyourchurchpalacios\.org/);

      const result = await transporter.sendMail({
        from: `Find Your Church Palacios <${expectedFrom}>`,
        to: expectedRecipient,
        replyTo: expectedReplyTo,
        subject,
        text: renderings.text,
        html: renderings.html,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
      });

      assert.deepEqual(result.rejected, []);
      assert.ok(result.accepted.length === 1, `${definition.key} was not accepted exactly once.`);
      sent.push({
        template: definition.key,
        subject,
        accepted: result.accepted.length,
        rejected: result.rejected.length,
        messageId: redactProviderResponse(result.messageId),
        attachments: attachmentEvidence,
      });
    }

    assert.equal(new Set(sent.map((item) => item.template)).size, stagingEmailTemplateDefinitions.length);

    const bounceRecipient = `fyc-${sessionId}@${invalidBounceDomain}`;
    let bounceResult: { status: "rejected" | "accepted-pending-async"; response: string };
    try {
      const result = await transporter.sendMail({
        from: `Find Your Church Palacios <${expectedFrom}>`,
        to: bounceRecipient,
        replyTo: expectedReplyTo,
        subject: `[FYC prelaunch ${sessionId}] Controlled invalid-recipient test`,
        text: "Controlled prelaunch invalid-recipient test. No reply or action is required.",
      });
      bounceResult = {
        status: "accepted-pending-async",
        response: redactProviderResponse(result.response),
      };
    } catch (error) {
      bounceResult = {
        status: "rejected",
        response: redactProviderResponse(error instanceof Error ? error.message : error),
      };
    }

    console.log(JSON.stringify({
      ok: true,
      suite: "production-email-provider-certification",
      sessionId,
      smtpConnectionVerified: true,
      approvedRecipientLabel: "owner-approved Gmail test mailbox",
      templatesSent: sent.length,
      acceptedMessages: sent.reduce((sum, item) => sum + item.accepted, 0),
      rejectedMessages: sent.reduce((sum, item) => sum + item.rejected, 0),
      attachmentTypesSent: Array.from(new Set(sent.flatMap((item) => item.attachments.map((attachment) => attachment.type)))),
      templateEvidence: sent,
      invalidRecipientTest: bounceResult,
      secretsPrinted: false,
    }, null, 2));
  } finally {
    transporter.close();
  }
}

run().catch((error) => {
  console.error(redactProviderResponse(error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
