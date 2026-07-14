import nodemailer from "nodemailer";

import { getApplicationEnvironment } from "@/lib/app-environment";
import { siteConfig } from "@/lib/config/site";
import { createEmailLogInFirebase } from "@/lib/repositories/firebase-email-log-repository";
import { createOperationalEvent } from "@/lib/services/operational-log-service";

export type EmailProvider = "console" | "resend" | "smtp";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

function normalizeOptionalValue(value?: string) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function extractEmailAddress(value: string) {
  const angleBracketMatch = value.match(/<([^<>]+)>\s*$/);
  return (angleBracketMatch?.[1] ?? value).trim().toLowerCase();
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractEmailAddress(value));
}

function getRecipientDomain(value: string) {
  return extractEmailAddress(value).split("@")[1] ?? "invalid";
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function getConfiguredEmailProvider(): EmailProvider {
  const configuredProvider = normalizeOptionalValue(process.env.EMAIL_PROVIDER)?.toLowerCase();

  if (
    configuredProvider === "console" ||
    configuredProvider === "resend" ||
    configuredProvider === "smtp"
  ) {
    return configuredProvider;
  }

  return "console";
}

export function getEmailFromAddress() {
  return normalizeOptionalValue(process.env.EMAIL_FROM) ?? siteConfig.contactEmail;
}

export function getEmailReplyToAddress() {
  return normalizeOptionalValue(process.env.SMTP_REPLY_TO);
}

export function getAdminNotificationEmails() {
  const rawValue = normalizeOptionalValue(process.env.ADMIN_NOTIFICATION_EMAIL);
  const configuredRecipients = rawValue
    ? rawValue
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  return Array.from(
    new Set(
      [...configuredRecipients, ...(siteConfig.adminNotificationFallbackEmails ?? [])].filter(
        Boolean,
      ),
    ),
  );
}

export function getAdminNotificationEmail() {
  return getAdminNotificationEmails()[0];
}

export function getEmailConfigurationProblems(provider = getConfiguredEmailProvider()) {
  const problems: string[] = [];
  const from = getEmailFromAddress();
  const configuredFrom = normalizeOptionalValue(process.env.EMAIL_FROM);
  const configuredProvider = normalizeOptionalValue(process.env.EMAIL_PROVIDER)?.toLowerCase();
  const replyTo = getEmailReplyToAddress();

  if (configuredProvider && !["console", "resend", "smtp"].includes(configuredProvider)) {
    problems.push("EMAIL_PROVIDER must be console, resend, or smtp.");
  }

  if (!from) {
    problems.push("EMAIL_FROM is missing.");
  } else if (!isValidEmailAddress(from)) {
    problems.push("EMAIL_FROM must contain a valid email address.");
  }

  const adminNotificationEmails = getAdminNotificationEmails();
  if (adminNotificationEmails.length === 0) {
    problems.push("ADMIN_NOTIFICATION_EMAIL is missing.");
  } else if (adminNotificationEmails.some((email) => !isValidEmailAddress(email))) {
    problems.push("ADMIN_NOTIFICATION_EMAIL contains an invalid email address.");
  }

  if (replyTo && !isValidEmailAddress(replyTo)) {
    problems.push("SMTP_REPLY_TO must contain a valid email address when configured.");
  }

  if (provider === "resend" && !normalizeOptionalValue(process.env.RESEND_API_KEY)) {
    problems.push("RESEND_API_KEY is missing for EMAIL_PROVIDER=resend.");
  }

  if (provider === "smtp") {
    const smtpHost = normalizeOptionalValue(process.env.SMTP_HOST);
    const smtpPort = normalizeOptionalValue(process.env.SMTP_PORT);
    const smtpUser = normalizeOptionalValue(process.env.SMTP_USER);
    const smtpPassword = normalizeOptionalValue(process.env.SMTP_PASSWORD);

    if (!configuredFrom) {
      problems.push("EMAIL_FROM is required for EMAIL_PROVIDER=smtp.");
    }

    if (!smtpHost) {
      problems.push("SMTP_HOST is missing for EMAIL_PROVIDER=smtp.");
    }

    if (!smtpPort) {
      problems.push("SMTP_PORT is missing for EMAIL_PROVIDER=smtp.");
    } else {
      const parsedPort = Number(smtpPort);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        problems.push("SMTP_PORT must be an integer between 1 and 65535.");
      }
    }

    if (!smtpUser) {
      problems.push("SMTP_USER is missing for EMAIL_PROVIDER=smtp.");
    }

    if (!smtpPassword) {
      problems.push("SMTP_PASSWORD is missing for EMAIL_PROVIDER=smtp.");
    }

    if (getApplicationEnvironment() === "staging") {
      const testRecipient = normalizeOptionalValue(process.env.TEST_EMAIL_TO);
      if (!testRecipient) {
        problems.push("TEST_EMAIL_TO is required for staging SMTP tests.");
      } else if (!isValidEmailAddress(testRecipient)) {
        problems.push("TEST_EMAIL_TO must contain one valid staging test address.");
      } else if (/[;,]/.test(testRecipient)) {
        problems.push("TEST_EMAIL_TO must contain exactly one staging test address.");
      }

      if (process.env.ALLOW_REAL_EMAIL_TEST?.trim().toLowerCase() !== "true") {
        problems.push("ALLOW_REAL_EMAIL_TEST=true is required for staging SMTP tests.");
      }
    }
  }

  return problems;
}

export function getStagingEmailTestReadiness() {
  const environment = getApplicationEnvironment();
  const provider = getConfiguredEmailProvider();
  const approvedRecipient = normalizeOptionalValue(process.env.TEST_EMAIL_TO);
  const problems = getEmailConfigurationProblems(provider);

  if (environment !== "staging") {
    problems.push("The email test tool is available only in staging.");
  }

  if (provider !== "smtp") {
    problems.push("EMAIL_PROVIDER must be smtp before staging delivery tests can run.");
  }

  return {
    environment,
    provider,
    approvedRecipientConfigured: Boolean(approvedRecipient),
    ready: problems.length === 0,
    problems: Array.from(new Set(problems)),
  };
}

export function assertApprovedStagingEmailRecipient(recipient: string) {
  const readiness = getStagingEmailTestReadiness();
  const approvedRecipient = normalizeOptionalValue(process.env.TEST_EMAIL_TO);

  if (!readiness.ready || !approvedRecipient) {
    throw createEmailConfigurationError(
      `Staging email delivery is not ready. ${readiness.problems.join(" ")}`,
    );
  }

  if (extractEmailAddress(recipient) !== extractEmailAddress(approvedRecipient)) {
    throw createEmailConfigurationError(
      "Staging email tests may send only to the approved TEST_EMAIL_TO recipient.",
    );
  }
}

function createBodyPreview(messageBody: string) {
  void messageBody;
  return "Email content omitted from logs.";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineHtml(value: string) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
  let html = "";
  let lastIndex = 0;

  for (const match of value.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    html += escapeHtml(value.slice(lastIndex, matchIndex));

    if (match[1] && match[2]) {
      html += `<a href="${escapeHtml(match[2])}" style="color:#0B4A24;text-decoration:underline;">${escapeHtml(match[1])}</a>`;
    } else if (match[3]) {
      html += `<a href="${escapeHtml(match[3])}" style="color:#0B4A24;text-decoration:underline;">${escapeHtml(match[3])}</a>`;
    }

    lastIndex = matchIndex + match[0].length;
  }

  html += escapeHtml(value.slice(lastIndex));
  return html;
}

function createTextEmailBody(messageBody: string) {
  return messageBody.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2");
}

function createHtmlEmailBody(messageBody: string) {
  const blocks = messageBody
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => renderInlineHtml(line));
      return `<p style="margin:0 0 16px 0;line-height:1.6;">${lines.join("<br />")}</p>`;
    });

  return [
    '<div style="font-family:Georgia,serif;color:#1f2f26;font-size:16px;">',
    ...blocks,
    "</div>",
  ].join("");
}

export function createEmailRenderings(messageBody: string) {
  return {
    text: createTextEmailBody(messageBody),
    html: createHtmlEmailBody(messageBody),
  };
}

function createEmailConfigurationError(message: string) {
  return new Error(message);
}

function getSafeEmailErrorMessage(error: unknown) {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const secretValues = [
    process.env.SMTP_PASSWORD,
    process.env.SMTP_USER,
    process.env.RESEND_API_KEY,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return secretValues
    .reduce((message, secret) => message.replaceAll(secret, "[redacted]"), originalMessage)
    .replace(/(?:smtp|smtps):\/\/[^\s]+/gi, "[redacted SMTP endpoint]")
    .replace(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/g, "[redacted email]")
    .slice(0, 500);
}

async function logEmailRecord(input: {
  to: string;
  from?: string;
  subject: string;
  body: string;
  status: string;
  provider: EmailProvider;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  return createEmailLogInFirebase({
    to: input.to,
    from: input.from,
    subject: input.subject,
    bodyPreview: createBodyPreview(input.body),
    status: input.status,
    provider: input.provider,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
  });
}

async function sendConsoleEmail(input: {
  to: string;
  from?: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  attachments?: EmailAttachment[];
}) {
  console.log(
    `[email:console] recipientDomain=${getRecipientDomain(input.to)} subject=${input.subject} attachmentCount=${input.attachments?.length ?? 0} body=omitted`,
  );

  await logEmailRecord({
    ...input,
    status: "logged",
    provider: "console",
  });
}

async function sendResendEmail(input: {
  to: string;
  from: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}) {
  const apiKey = normalizeOptionalValue(process.env.RESEND_API_KEY);

  if (!apiKey) {
    throw createEmailConfigurationError(
      "EMAIL_PROVIDER is set to resend, but RESEND_API_KEY is missing.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      reply_to: input.replyTo,
      text: createTextEmailBody(input.body),
      html: createHtmlEmailBody(input.body),
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString("base64"),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with HTTP ${response.status}.`);
  }

  await logEmailRecord({
    ...input,
    status: "sent",
    provider: "resend",
  });
}

async function sendSmtpEmail(input: {
  to: string;
  from: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}) {
  const smtpHost = normalizeOptionalValue(process.env.SMTP_HOST);
  const smtpPort = normalizeOptionalValue(process.env.SMTP_PORT);
  const smtpUser = normalizeOptionalValue(process.env.SMTP_USER);
  const smtpPassword = normalizeOptionalValue(process.env.SMTP_PASSWORD);

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    throw createEmailConfigurationError(
      "EMAIL_PROVIDER is set to smtp, but one or more SMTP settings are missing.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    replyTo: input.replyTo,
    text: createTextEmailBody(input.body),
    html: createHtmlEmailBody(input.body),
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });

  await logEmailRecord({
    ...input,
    status: "sent",
    provider: "smtp",
  });
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  required?: boolean;
  attachments?: EmailAttachment[];
}) {
  const provider = getConfiguredEmailProvider();
  const from = getEmailFromAddress();
  const replyTo = getEmailReplyToAddress();

  if (provider === "smtp" && getApplicationEnvironment() === "staging") {
    assertApprovedStagingEmailRecipient(input.to);
  }

  try {
    if (provider === "console") {
      await sendConsoleEmail({
        to: input.to,
        from,
        subject: input.subject,
        body: input.body,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        attachments: input.attachments,
      });
      return;
    }

    if (!from) {
      throw createEmailConfigurationError(
        "EMAIL_FROM must be configured when using a non-console email provider.",
      );
    }

    if (provider === "resend") {
      await sendResendEmail({
        to: input.to,
        from,
        subject: input.subject,
        body: input.body,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        attachments: input.attachments,
        replyTo,
      });
      return;
    }

    await sendSmtpEmail({
      to: input.to,
      from,
      subject: input.subject,
      body: input.body,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      attachments: input.attachments,
      replyTo,
    });
  } catch (error) {
    const errorMessage = getSafeEmailErrorMessage(error);

    await Promise.allSettled([
      logEmailRecord({
        to: input.to,
        from,
        subject: input.subject,
        body: input.body,
        status: "failed",
        provider,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      }),
      createOperationalEvent({
        type: "transactional_email_failed",
        severity: "error",
        entityType: input.relatedEntityType ?? "email",
        entityId: input.relatedEntityId,
        summary: "A transactional email attempt failed. Content and credentials were omitted.",
        metadata: {
          provider,
          recipientDomain: getRecipientDomain(input.to),
          error: errorMessage,
        },
      }),
    ]);

    if (isProductionEnvironment() && input.required !== false) {
      throw new Error(`Email delivery failed. ${errorMessage}`);
    }

    console.warn(`Email delivery skipped or failed: ${errorMessage}`);
  }
}
