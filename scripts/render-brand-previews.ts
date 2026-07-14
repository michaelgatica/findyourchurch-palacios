import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createEmailRenderings } from "@/lib/services/email-service";
import { createStagingEmailMessage } from "@/lib/services/staging-email-test-service";

async function run() {
  const outputDirectory = path.resolve(".playwright-mcp", "premium-artifact-previews");
  await mkdir(outputDirectory, { recursive: true });

  const originalFrom = process.env.EMAIL_FROM;
  const originalReplyTo = process.env.SMTP_REPLY_TO;
  process.env.EMAIL_FROM = "Find Your Church Palacios <noreply@findyourchurchpalacios.org>";
  process.env.SMTP_REPLY_TO = "support@findyourchurchpalacios.org";

  try {
    const confirmation = await createStagingEmailMessage("registration_confirmation");
    const renderings = createEmailRenderings(confirmation.body);
    await writeFile(path.join(outputDirectory, "registration-confirmation.html"), renderings.html);
    await writeFile(path.join(outputDirectory, "registration-confirmation.txt"), renderings.text);

    const reports = await createStagingEmailMessage("combined_report");
    const attachments = "attachments" in reports ? reports.attachments ?? [] : [];
    for (const attachment of attachments) {
      await writeFile(path.join(outputDirectory, attachment.filename), attachment.content);
    }

    console.log(JSON.stringify({
      ok: true,
      outputDirectory,
      files: [
        "registration-confirmation.html",
        "registration-confirmation.txt",
        ...attachments.map((attachment) => attachment.filename),
      ],
      dataClassification: "fictitious staging preview only",
    }, null, 2));
  } finally {
    if (originalFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalFrom;
    if (originalReplyTo === undefined) delete process.env.SMTP_REPLY_TO;
    else process.env.SMTP_REPLY_TO = originalReplyTo;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
