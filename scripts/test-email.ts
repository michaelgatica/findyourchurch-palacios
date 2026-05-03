import { config as loadEnv } from "dotenv";

import { siteConfig } from "@/lib/config/site";
import {
  getAdminNotificationEmail,
  getConfiguredEmailProvider,
  getEmailConfigurationProblems,
  getEmailFromAddress,
  sendTransactionalEmail,
} from "@/lib/services/email-service";

loadEnv({
  path: ".env.local",
});

async function run() {
  const provider = getConfiguredEmailProvider();
  const from = getEmailFromAddress();
  const adminNotificationEmail = getAdminNotificationEmail();
  const testRecipient =
    process.env.TEST_EMAIL_TO?.trim() ||
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    siteConfig.contactEmail;
  const allowRealEmailTest = process.env.ALLOW_REAL_EMAIL_TEST?.trim() === "true";
  const configurationProblems = getEmailConfigurationProblems(provider);

  console.log("Email provider test");
  console.log(`- Provider: ${provider}`);
  console.log(`- From: ${from}`);
  console.log(`- Admin notification email: ${adminNotificationEmail ?? "not configured"}`);
  console.log(`- Test recipient: ${testRecipient}`);

  if (configurationProblems.length > 0) {
    console.log("Configuration warnings:");
    for (const configurationProblem of configurationProblems) {
      console.log(`- ${configurationProblem}`);
    }
  }

  if (provider !== "console" && !allowRealEmailTest) {
    throw new Error(
      "Refusing to send a real provider email without ALLOW_REAL_EMAIL_TEST=true. Use EMAIL_PROVIDER=console for local logging-only tests.",
    );
  }

  await sendTransactionalEmail({
    to: testRecipient,
    subject: `Find Your Church email test (${provider})`,
    body: [
      "This is a Find Your Church Palacios email test.",
      "",
      `Provider: ${provider}`,
      `From: ${from}`,
      `Recipient: ${testRecipient}`,
      "",
      "If you received this unexpectedly, please review the email provider configuration before launch.",
    ].join("\n"),
    relatedEntityType: "emailTest",
    relatedEntityId: new Date().toISOString(),
  });

  console.log("Email test completed.");
}

run().catch((error) => {
  console.error("Email test failed.", error);
  process.exitCode = 1;
});
