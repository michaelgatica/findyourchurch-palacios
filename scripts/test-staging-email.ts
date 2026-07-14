import assert from "node:assert/strict";

import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

import {
  assertApprovedStagingEmailRecipient,
  createEmailRenderings,
  getEmailConfigurationProblems,
  getStagingEmailTestReadiness,
  sendTransactionalEmail,
} from "@/lib/services/email-service";
import {
  createStagingEmailMessage,
  stagingEmailTemplateDefinitions,
} from "@/lib/services/staging-email-test-service";

const managedEnvironmentKeys = [
  "APP_ENV",
  "NODE_ENV",
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "ADMIN_NOTIFICATION_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_REPLY_TO",
  "TEST_EMAIL_TO",
  "ALLOW_REAL_EMAIL_TEST",
] as const;

async function run() {
  const originalEnvironment = Object.fromEntries(
    managedEnvironmentKeys.map((key) => [key, process.env[key]]),
  );

  try {
    process.env.APP_ENV = "staging";
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.NEXT_PUBLIC_SITE_URL =
      "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.EMAIL_FROM = "Find Your Church Staging <sender@example.test>";
    process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.test";
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "70000";
    process.env.SMTP_USER = "staging-user";
    const configurationPasswordSentinel = ["staging", "placeholder", "not-a-real-secret"].join("-");
    process.env.SMTP_PASSWORD = configurationPasswordSentinel;
    process.env.SMTP_REPLY_TO = "not-an-email";
    delete process.env.TEST_EMAIL_TO;
    delete process.env.ALLOW_REAL_EMAIL_TEST;

    const invalidProblems = getEmailConfigurationProblems("smtp");
    assert.equal(invalidProblems.some((problem) => problem.includes("SMTP_PORT")), true);
    assert.equal(invalidProblems.some((problem) => problem.includes("SMTP_REPLY_TO")), true);
    assert.equal(invalidProblems.some((problem) => problem.includes("TEST_EMAIL_TO")), true);
    assert.equal(invalidProblems.some((problem) => problem.includes("ALLOW_REAL_EMAIL_TEST")), true);

    delete process.env.EMAIL_FROM;
    assert.equal(
      getEmailConfigurationProblems("smtp").some((problem) => problem.includes("EMAIL_FROM is required")),
      true,
    );
    process.env.EMAIL_FROM = "Find Your Church Staging <sender@example.test>";

    process.env.SMTP_PORT = "465";
    process.env.SMTP_REPLY_TO = "reply@example.test";
    process.env.TEST_EMAIL_TO = "approved@example.test";
    process.env.ALLOW_REAL_EMAIL_TEST = "true";

    const readiness = getStagingEmailTestReadiness();
    assert.equal(readiness.ready, true);
    assert.equal(readiness.approvedRecipientConfigured, true);
    assert.doesNotThrow(() => assertApprovedStagingEmailRecipient("approved@example.test"));
    assert.throws(
      () => assertApprovedStagingEmailRecipient("unapproved@example.test"),
      /approved TEST_EMAIL_TO recipient/,
    );

    process.env.EMAIL_FROM = "Find Your Church Palacios <noreply@findyourchurchpalacios.org>";
    process.env.SMTP_REPLY_TO = "support@findyourchurchpalacios.org";
    const noreplyRendering = createEmailRenderings("Staging message body.");
    assert.match(
      noreplyRendering.text,
      /This mailbox is not monitored\. Please send replies or questions to support@findyourchurchpalacios\.org\./,
    );
    assert.match(noreplyRendering.html, /This mailbox is not monitored\./);
    assert.match(noreplyRendering.text, /provided free of charge by El Roi Digital Ministries/i);
    assert.match(noreplyRendering.text, /https:\/\/elroidigital\.org\/donate\.html/);
    assert.match(noreplyRendering.html, /Support the ministry/);
    assert.match(noreplyRendering.html, /https:\/\/elroidigital\.org\/donate\.html/);

    assert.equal(stagingEmailTemplateDefinitions.length, 15);
    const attachmentNames: string[] = [];
    for (const definition of stagingEmailTemplateDefinitions) {
      const message = await createStagingEmailMessage(definition.key);
      assert.equal(Boolean(message.subject.trim()), true, `${definition.key} must have a subject.`);
      assert.equal(Boolean(message.body.trim()), true, `${definition.key} must have a body.`);
      assert.equal(/allergy|medical|emergency[- ]contact|child answer/i.test(message.subject), false);
      assert.equal(/allergy|medical|emergency[- ]contact|child answer/i.test(message.body), false);

      const renderings = createEmailRenderings(message.body);
      assert.equal(Boolean(renderings.text.trim()), true);
      assert.equal(renderings.html.includes("font-family"), true);
      assert.match(renderings.text, /This mailbox is not monitored\./);
      assert.match(renderings.text, /support@findyourchurchpalacios\.org/);
      assert.match(renderings.html, /This mailbox is not monitored\./);
      assert.match(renderings.html, /support@findyourchurchpalacios\.org/);
      assert.match(renderings.html, /provided free of charge by El Roi Digital Ministries/i);
      assert.match(renderings.html, /Support the ministry/);
      const links = message.body.match(/https?:\/\/[^\s)]+/g) ?? [];
      assert.equal(
        links.every((url) => new URL(url).hostname.includes("findyourchurch-staging-2026")),
        true,
        `${definition.key} contained a non-staging link.`,
      );

      const attachments = "attachments" in message ? message.attachments ?? [] : [];
      for (const attachment of attachments) {
        attachmentNames.push(attachment.filename);
        if (attachment.contentType === "application/pdf") {
          const pdf = await PDFDocument.load(attachment.content);
          assert.equal(pdf.getPageCount() > 0, true);
        }
        if (attachment.contentType.includes("spreadsheetml")) {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(attachment.content as never);
          assert.equal(workbook.worksheets.length >= 2, true);
        }
      }
    }

    assert.equal(attachmentNames.some((name) => name.endsWith(".pdf")), true);
    assert.equal(attachmentNames.some((name) => name.endsWith(".xlsx")), true);

    const smtpUserSentinel = "private-staging-user@example.test";
    const smtpPasswordSentinel = "private-staging-password";
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1";
    process.env.SMTP_USER = smtpUserSentinel;
    process.env.SMTP_PASSWORD = smtpPasswordSentinel;
    await assert.rejects(
      sendTransactionalEmail({
        to: "approved@example.test",
        subject: "Controlled staging SMTP failure",
        body: "Fictitious content only.",
      }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.equal(message.includes(smtpPasswordSentinel), false);
        assert.equal(message.includes(smtpUserSentinel), false);
        assert.equal(message.includes("approved@example.test"), false);
        return true;
      },
    );

    console.log(JSON.stringify({
      ok: true,
      suite: "staging-email",
      templatesValidated: stagingEmailTemplateDefinitions.length,
      attachmentTypesValidated: ["pdf", "xlsx"],
      arbitraryRecipientDenied: true,
      controlledSmtpFailureRedacted: true,
      liveDeliveryAttempted: false,
    }, null, 2));
  } finally {
    for (const key of managedEnvironmentKeys) {
      const originalValue = originalEnvironment[key];
      if (originalValue === undefined) Reflect.deleteProperty(process.env, key);
      else Reflect.set(process.env, key, originalValue);
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
