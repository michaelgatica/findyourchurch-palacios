import nodemailer from "nodemailer";

import { siteConfig } from "@/lib/config/site";
import { createEmailLogInFirebase } from "@/lib/repositories/firebase-email-log-repository";

export type EmailProvider = "console" | "resend" | "smtp";

function normalizeOptionalValue(value?: string) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
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

  if (!from) {
    problems.push("EMAIL_FROM is missing.");
  }

  if (getAdminNotificationEmails().length === 0) {
    problems.push("ADMIN_NOTIFICATION_EMAIL is missing.");
  }

  if (provider === "resend" && !normalizeOptionalValue(process.env.RESEND_API_KEY)) {
    problems.push("RESEND_API_KEY is missing for EMAIL_PROVIDER=resend.");
  }

  if (provider === "smtp") {
    const smtpHost = normalizeOptionalValue(process.env.SMTP_HOST);
    const smtpPort = normalizeOptionalValue(process.env.SMTP_PORT);
    const smtpUser = normalizeOptionalValue(process.env.SMTP_USER);
    const smtpPassword = normalizeOptionalValue(process.env.SMTP_PASSWORD);

    if (!smtpHost) {
      problems.push("SMTP_HOST is missing for EMAIL_PROVIDER=smtp.");
    }

    if (!smtpPort) {
      problems.push("SMTP_PORT is missing for EMAIL_PROVIDER=smtp.");
    }

    if (!smtpUser) {
      problems.push("SMTP_USER is missing for EMAIL_PROVIDER=smtp.");
    }

    if (!smtpPassword) {
      problems.push("SMTP_PASSWORD is missing for EMAIL_PROVIDER=smtp.");
    }
  }

  return problems;
}

function createBodyPreview(messageBody: string) {
  return createTextEmailBody(messageBody).replace(/\s+/g, " ").trim().slice(0, 240);
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

function createEmailConfigurationError(message: string) {
  return new Error(message);
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
}) {
  console.log(
    `[email:console] to=${input.to} subject=${input.subject}\n${createTextEmailBody(input.body)}`,
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
      text: createTextEmailBody(input.body),
      html: createHtmlEmailBody(input.body),
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new Error(`Resend request failed: ${response.status} ${responseBody}`);
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
    text: createTextEmailBody(input.body),
    html: createHtmlEmailBody(input.body),
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
}) {
  const provider = getConfiguredEmailProvider();
  const from = getEmailFromAddress();

  try {
    if (provider === "console") {
      await sendConsoleEmail({
        to: input.to,
        from,
        subject: input.subject,
        body: input.body,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
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
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logEmailRecord({
      to: input.to,
      from,
      subject: input.subject,
      body: input.body,
      status: "failed",
      provider,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    });

    if (isProductionEnvironment() && input.required !== false) {
      throw error instanceof Error
        ? error
        : new Error(`Email delivery failed. ${errorMessage}`);
    }

    console.warn(`Email delivery skipped or failed: ${errorMessage}`);
  }
}
